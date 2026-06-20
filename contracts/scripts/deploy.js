import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  console.log("Starting deployment...");

  // These should be configured in your .env or replaced with actual addresses
  const PAYMENT_TOKEN = process.env.PAYMENT_TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Mock USDC on Base Sepolia
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0x..."; // Replace with real admin address
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "0x..."; // Replace with real verifier address
  const FEE_COLLECTOR_ADDRESS = process.env.FEE_COLLECTOR_ADDRESS || "0x..."; // Replace with real fee collector

  const CampaignEscrow = await ethers.getContractFactory("CampaignEscrow");
  const escrow = await CampaignEscrow.deploy(PAYMENT_TOKEN, ADMIN_ADDRESS, VERIFIER_ADDRESS, FEE_COLLECTOR_ADDRESS);

  await escrow.waitForDeployment();

  console.log("CampaignEscrow deployed to:", await escrow.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
