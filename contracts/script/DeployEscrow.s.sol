// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract DeployEscrow is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address verifier = vm.envAddress("VERIFIER_ADDRESS");
        address feeCollector = vm.envAddress("FEE_COLLECTOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock USDC
        MockERC20 usdc = new MockERC20("Mock USDC", "USDC", 6);
        console2.log("Mock USDC deployed at:", address(usdc));

        // 2. Deploy CampaignEscrow
        CampaignEscrow escrow = new CampaignEscrow(
            address(usdc),
            admin,
            verifier,
            feeCollector
        );
        console2.log("CampaignEscrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }
}
