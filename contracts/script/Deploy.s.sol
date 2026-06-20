// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address verifier = vm.envAddress("VERIFIER_ADDRESS");
        address paymentToken = vm.envAddress("PAYMENT_TOKEN_ADDRESS");
        address feeCollector = vm.envAddress("FEE_COLLECTOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        CampaignEscrow escrow = new CampaignEscrow(
            paymentToken,
            admin,
            verifier,
            feeCollector
        );

        console2.log("CampaignEscrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }
}
