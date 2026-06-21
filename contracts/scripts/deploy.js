import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  console.log("Starting deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Use deployer for roles if not specified in .env
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || deployer.address;
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || deployer.address;
  const FEE_COLLECTOR_ADDRESS = process.env.FEE_COLLECTOR_ADDRESS || deployer.address;

  let PAYMENT_TOKEN = process.env.PAYMENT_TOKEN_ADDRESS;

  if (!PAYMENT_TOKEN) {
    console.log("No PAYMENT_TOKEN_ADDRESS found in .env. Deploying MockUSDC...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await usdc.waitForDeployment();
    PAYMENT_TOKEN = await usdc.getAddress();
    console.log("Mock USDC deployed to:", PAYMENT_TOKEN);
    
    // Mint to deployer for testing
    await usdc.mint(deployer.address, ethers.parseUnits("10000", 6));
  } else {
    console.log("Using existing USDC at:", PAYMENT_TOKEN);
  }

  const CampaignEscrow = await ethers.getContractFactory("CampaignEscrow");
  const escrow = await CampaignEscrow.deploy(PAYMENT_TOKEN, ADMIN_ADDRESS, VERIFIER_ADDRESS, FEE_COLLECTOR_ADDRESS);

  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log("CampaignEscrow deployed to:", escrowAddress);
  console.log("\n--- Update your .env.local ---");
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${PAYMENT_TOKEN}`);
  console.log(`NEXT_PUBLIC_CAMPAIGN_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`PAYOUT_SIGNER_PRIVATE_KEY=<Insert the private key of ${VERIFIER_ADDRESS}>`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
