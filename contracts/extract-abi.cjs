const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, 'artifacts', 'src', 'CampaignEscrow.sol', 'CampaignEscrow.json');
const outputPath = path.join(__dirname, '..', 'lib', 'contracts', 'campaign-escrow.ts');

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const content = `import { Address } from "viem";\n\nexport const campaignEscrowAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n\nexport const CAMPAIGN_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_CAMPAIGN_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;\n`;

fs.writeFileSync(outputPath, content);
console.log('ABI extracted to', outputPath);
