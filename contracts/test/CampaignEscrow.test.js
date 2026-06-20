import { expect } from "chai";
import hre from "hardhat";

describe("CampaignEscrow", function () {
  let CampaignEscrow, escrow, MockERC20, usdc;
  let owner, admin, verifier, feeCollector, brand, clipper;

  beforeEach(async function () {
    [owner, admin, verifier, feeCollector, brand, clipper] = await hre.ethers.getSigners();

    MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);

    CampaignEscrow = await hre.ethers.getContractFactory("CampaignEscrow");
    escrow = await CampaignEscrow.deploy(usdc.target, admin.address, verifier.address, feeCollector.address);

    // Mint USDC to brand
    await usdc.mint(brand.address, hre.ethers.parseUnits("10000", 6));
    // Approve escrow
    await usdc.connect(brand).approve(escrow.target, hre.ethers.MaxUint256);
  });

  it("Should create a campaign correctly", async function () {
    const rewardPool = hre.ethers.parseUnits("500", 6);
    const feeReserve = hre.ethers.parseUnits("25", 6);
    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const maxWinners = 10;
    const metadataHash = hre.ethers.id("metadata");

    await escrow.connect(brand).createCampaign(
      metadataHash,
      rewardPool,
      feeReserve,
      deadline,
      maxWinners
    );

    const balance = await usdc.balanceOf(escrow.target);
    expect(balance).to.equal(rewardPool + feeReserve);

    const campaign = await escrow.campaigns(1);
    expect(campaign.brand).to.equal(brand.address);
    expect(campaign.rewardPool).to.equal(rewardPool);
    expect(campaign.feeReserve).to.equal(feeReserve);
    expect(campaign.deadline).to.equal(deadline);
    expect(campaign.maxWinners).to.equal(maxWinners);
    expect(campaign.status).to.equal(1); // OPEN
  });

  it("Should process a valid claim", async function () {
    // Create Campaign
    const rewardPool = hre.ethers.parseUnits("500", 6);
    const feeReserve = hre.ethers.parseUnits("25", 6);
    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const metadataHash = hre.ethers.id("metadata");

    await escrow.connect(brand).createCampaign(
      metadataHash,
      rewardPool,
      feeReserve,
      deadline,
      10
    );

    // Prepare Claim
    const campaignId = 1n;
    const submissionId = hre.ethers.encodeBytes32String("sub1");
    const rewardAmount = hre.ethers.parseUnits("50", 6);
    const platformFee = hre.ethers.parseUnits("2", 6);
    const nonce = 1n;
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const domain = {
      name: "CampaignEscrow",
      version: "1",
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: escrow.target
    };

    const types = {
      PayoutAuthorization: [
        { name: "campaignId", type: "uint256" },
        { name: "submissionId", type: "bytes32" },
        { name: "clipperWallet", type: "address" },
        { name: "rewardAmount", type: "uint256" },
        { name: "platformFee", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    const value = {
      campaignId,
      submissionId,
      clipperWallet: clipper.address,
      rewardAmount,
      platformFee,
      nonce,
      expiry
    };

    const signature = await verifier.signTypedData(domain, types, value);

    await expect(escrow.connect(clipper).claimReward(
      campaignId,
      submissionId,
      rewardAmount,
      platformFee,
      nonce,
      expiry,
      signature
    )).to.emit(escrow, "RewardClaimed")
      .withArgs(campaignId, submissionId, clipper.address, rewardAmount, platformFee);

    expect(await usdc.balanceOf(clipper.address)).to.equal(rewardAmount);
    expect(await usdc.balanceOf(feeCollector.address)).to.equal(platformFee);
  });
});
