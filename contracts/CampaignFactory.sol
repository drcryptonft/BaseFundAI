// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Campaign.sol";

contract CampaignFactory {

    address public immutable usdc;
    address[] public campaigns;

    event CampaignCreated(
        address indexed campaign,
        address indexed creator,
        uint256 goal,
        uint256 deadline
    );

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = _usdc;
    }

    function createCampaign(
        uint256 goal,
        uint256 durationInDays
    ) external {

        Campaign campaign = new Campaign(
            usdc,
            msg.sender,
            goal,
            durationInDays
        );

        campaigns.push(address(campaign));

        emit CampaignCreated(
            address(campaign),
            msg.sender,
            goal,
            campaign.deadline()
        );
    }

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}