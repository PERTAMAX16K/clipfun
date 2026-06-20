// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CampaignEscrow is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    IERC20 public immutable paymentToken;
    address public feeCollector;

    enum CampaignStatus { DRAFT, OPEN, COMPLETED, REFUNDED, PAUSED }

    struct Campaign {
        address brand;
        uint128 rewardPool;
        uint128 feeReserve;
        uint128 totalPaid;
        uint64 deadline;
        uint32 maxWinners;
        uint32 paidWinners;
        bytes32 metadataHash;
        CampaignStatus status;
    }

    uint256 public campaignCounter;
    mapping(uint256 => Campaign) public campaigns;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(uint256 => mapping(bytes32 => bool)) public hasClaimed;

    event CampaignCreated(uint256 indexed campaignId, address indexed brand, uint256 rewardPool, uint256 feeReserve);
    event RewardClaimed(uint256 indexed campaignId, bytes32 indexed submissionId, address indexed clipper, uint256 reward, uint256 fee);
    event CampaignClosed(uint256 indexed campaignId);
    event CampaignRefunded(uint256 indexed campaignId, address indexed brand, uint256 remainingAmount);
    event FeeCollectorUpdated(address indexed newCollector);

    error InvalidDeadline();
    error InsufficientAllowance();
    error TransferFailed();
    error CampaignNotOpen();
    error CampaignExpired();
    error MaxWinnersReached();
    error AlreadyClaimed();
    error InvalidSignature();
    error SignatureExpired();
    error NonceAlreadyUsed();
    error Unauthorized();
    error CampaignNotEnded();
    error InvalidFeeReserve();

    bytes32 private constant PAYOUT_TYPEHASH = keccak256("PayoutAuthorization(uint256 campaignId,bytes32 submissionId,address clipperWallet,uint256 rewardAmount,uint256 platformFee,uint256 nonce,uint256 expiry)");

    constructor(address _paymentToken, address _admin, address _verifier, address _feeCollector) EIP712("CampaignEscrow", "1") {
        require(_paymentToken != address(0), "Invalid token");
        require(_feeCollector != address(0), "Invalid fee collector");
        paymentToken = IERC20(_paymentToken);
        feeCollector = _feeCollector;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(VERIFIER_ROLE, _verifier);
    }

    function setFeeCollector(address _feeCollector) external onlyRole(ADMIN_ROLE) {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    function createCampaign(
        bytes32 metadataHash,
        uint256 rewardPool,
        uint256 feeReserve,
        uint256 deadline,
        uint256 maxWinners
    ) external whenNotPaused nonReentrant {
        if (deadline <= block.timestamp) revert InvalidDeadline();

        uint256 totalDeposit = rewardPool + feeReserve;
        paymentToken.safeTransferFrom(msg.sender, address(this), totalDeposit);

        uint256 campaignId = ++campaignCounter;
        
        campaigns[campaignId] = Campaign({
            brand: msg.sender,
            rewardPool: uint128(rewardPool),
            feeReserve: uint128(feeReserve),
            totalPaid: 0,
            deadline: uint64(deadline),
            maxWinners: uint32(maxWinners),
            paidWinners: 0,
            metadataHash: metadataHash,
            status: CampaignStatus.OPEN
        });

        emit CampaignCreated(campaignId, msg.sender, rewardPool, feeReserve);
    }

    function claimReward(
        uint256 campaignId,
        bytes32 submissionId,
        uint256 reward,
        uint256 fee,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        
        if (campaign.status != CampaignStatus.OPEN) revert CampaignNotOpen();
        if (block.timestamp > campaign.deadline) revert CampaignExpired();
        if (campaign.paidWinners >= campaign.maxWinners) revert MaxWinnersReached();
        if (hasClaimed[campaignId][submissionId]) revert AlreadyClaimed();
        if (block.timestamp > expiry) revert SignatureExpired();
        if (usedNonces[msg.sender][nonce]) revert NonceAlreadyUsed();

        bytes32 structHash = keccak256(abi.encode(
            PAYOUT_TYPEHASH,
            campaignId,
            submissionId,
            msg.sender,
            reward,
            fee,
            nonce,
            expiry
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        
        if (!hasRole(VERIFIER_ROLE, signer)) revert InvalidSignature();

        usedNonces[msg.sender][nonce] = true;
        hasClaimed[campaignId][submissionId] = true;
        
        campaign.paidWinners += 1;
        campaign.totalPaid += uint128(reward);
        
        // Ensure there are enough funds (checking totalPaid vs rewardPool)
        if (campaign.totalPaid > campaign.rewardPool) revert TransferFailed();
        
        // We do not track total fee paid in the struct directly to keep it simple, 
        // but we deduct the fee logically from the remaining funds on refund.
        // Actually, let's just transfer the fee to feeCollector immediately.
        paymentToken.safeTransfer(feeCollector, fee);
        paymentToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(campaignId, submissionId, msg.sender, reward, fee);
        
        if (campaign.paidWinners == campaign.maxWinners) {
            campaign.status = CampaignStatus.COMPLETED;
            emit CampaignClosed(campaignId);
        }
    }

    function closeCampaign(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        if (msg.sender != campaign.brand && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        if (campaign.status != CampaignStatus.OPEN) revert CampaignNotOpen();
        
        campaign.status = CampaignStatus.COMPLETED;
        emit CampaignClosed(campaignId);
    }

    function refundRemaining(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        if (msg.sender != campaign.brand && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        if (campaign.status == CampaignStatus.REFUNDED) revert CampaignNotOpen();
        
        if (campaign.status == CampaignStatus.OPEN && block.timestamp <= campaign.deadline) revert CampaignNotEnded();

        campaign.status = CampaignStatus.REFUNDED;

        uint256 remainingReward = campaign.rewardPool - campaign.totalPaid;
        
        // Fee logic: If there are unpaid winners, the corresponding fee reserve should also be refunded
        // Since reward per winner = rewardPool / maxWinners, fee per winner = feeReserve / maxWinners
        uint256 remainingWinners = campaign.maxWinners - campaign.paidWinners;
        uint256 remainingFee = 0;
        if (campaign.maxWinners > 0) {
            remainingFee = (campaign.feeReserve * remainingWinners) / campaign.maxWinners;
        }

        uint256 totalRefund = remainingReward + remainingFee;
        
        if (totalRefund > 0) {
            paymentToken.safeTransfer(campaign.brand, totalRefund);
            emit CampaignRefunded(campaignId, campaign.brand, totalRefund);
        }
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
