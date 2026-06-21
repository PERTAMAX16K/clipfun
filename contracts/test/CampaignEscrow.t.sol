// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CampaignEscrowTest is Test {
    CampaignEscrow public escrow;
    MockERC20 public usdc;

    address public admin = makeAddr("admin");
    
    uint256 public verifierPrivateKey;
    address public verifier;

    address public feeCollector = makeAddr("feeCollector");
    address public brand = makeAddr("brand");
    address public clipper = makeAddr("clipper");

    bytes32 private constant PAYOUT_TYPEHASH = keccak256("PayoutAuthorization(uint256 campaignId,bytes32 submissionId,address clipperWallet,uint256 rewardAmount,uint256 platformFee,uint256 nonce,uint256 expiry)");

    function setUp() public {
        // Setup verifier wallet with private key
        verifierPrivateKey = 0xA11CE;
        verifier = vm.addr(verifierPrivateKey);

        // Deploy USDC
        usdc = new MockERC20("Mock USDC", "USDC", 6);

        // Deploy Escrow
        vm.startPrank(admin);
        escrow = new CampaignEscrow(address(usdc), admin, verifier, feeCollector);
        vm.stopPrank();

        // Mint USDC to brand
        usdc.mint(brand, 10000 * 10**6);
    }

    function test_CreateCampaign() public {
        vm.startPrank(brand);
        usdc.approve(address(escrow), 1100 * 10**6);

        uint256 rewardPool = 1000 * 10**6;
        uint256 feeReserve = 100 * 10**6;
        uint256 deadline = block.timestamp + 7 days;
        bytes32 metadataHash = keccak256("metadata");

        escrow.createCampaign(metadataHash, rewardPool, feeReserve, deadline, 10);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(escrow)), 1100 * 10**6);

        (address cBrand, uint128 cRewardPool, uint128 cFeeReserve, uint128 cTotalPaid, uint64 cDeadline, uint32 cMaxWinners, uint32 cPaidWinners, bytes32 cMetadataHash, CampaignEscrow.CampaignStatus cStatus) = escrow.campaigns(1);
        
        assertEq(cBrand, brand);
        assertEq(cRewardPool, rewardPool);
        assertEq(cFeeReserve, feeReserve);
        assertEq(cDeadline, deadline);
        assertEq(cMaxWinners, 10);
        assertEq(uint(cStatus), uint(CampaignEscrow.CampaignStatus.OPEN));
    }

    function test_ClaimReward() public {
        // 1. Brand creates campaign
        vm.startPrank(brand);
        usdc.approve(address(escrow), 1100 * 10**6);
        escrow.createCampaign(keccak256("metadata"), 1000 * 10**6, 100 * 10**6, block.timestamp + 7 days, 10);
        vm.stopPrank();

        // 2. Prepare claim data
        uint256 campaignId = 1;
        bytes32 submissionId = keccak256("submission_1");
        uint256 reward = 100 * 10**6;
        uint256 fee = 10 * 10**6;
        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 1 days;

        // 3. Generate EIP-712 Signature
        bytes32 structHash = keccak256(abi.encode(
            PAYOUT_TYPEHASH,
            campaignId,
            submissionId,
            clipper,
            reward,
            fee,
            nonce,
            expiry
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            escrow.eip712Domain().domainSeparator,
            structHash
        ));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 4. Claim reward as clipper
        vm.startPrank(clipper);
        escrow.claimReward(campaignId, submissionId, reward, fee, nonce, expiry, signature);
        vm.stopPrank();

        // 5. Verify balances
        assertEq(usdc.balanceOf(clipper), reward);
        assertEq(usdc.balanceOf(feeCollector), fee);
    }
}
