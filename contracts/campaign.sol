
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Campaign is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MIN_GOAL = 5_000_000;           // 5 USDC (6 decimals)
    uint256 public constant MAX_GOAL = 1_000_000_000;       // 1000 USDC
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 60 days;

    /*//////////////////////////////////////////////////////////////
                              IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable usdc;
    address public immutable creator;
    uint256 public immutable goal;
    uint256 public immutable deadline;

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    uint256 public totalRaised;

    bool public finalized;
    bool public successful;

    mapping(address => uint256) public contributions;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event Contribution(
    address indexed campaign,
    address indexed contributor,
    uint256 amount
    );

    event CampaignFinalized(
    address indexed campaign,
    bool successful
    );

    event FundsClaimed(
    address indexed campaign,
    address indexed creator,
    uint256 amount
    );

    event RefundClaimed(
    address indexed campaign,
    address indexed contributor,
    uint256 amount
    );

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _usdc,
        address _creator,
        uint256 _goal,
        uint256 _durationInDays
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_creator != address(0), "Invalid creator");
        require(_goal >= MIN_GOAL, "Goal too small");
        require(_goal <= MAX_GOAL, "Goal too large");

        uint256 duration = _durationInDays * 1 days;
        require(duration >= MIN_DURATION, "Duration too short");
        require(duration <= MAX_DURATION, "Duration too long");

        usdc = IERC20(_usdc);
        creator = _creator;
        goal = _goal;
        deadline = block.timestamp + duration;
    }

    /*//////////////////////////////////////////////////////////////
                              CONTRIBUTION
    //////////////////////////////////////////////////////////////*/

    function contribute(uint256 amount) external nonReentrant {
        require(block.timestamp < deadline, "Campaign ended");
        require(!finalized, "Already finalized");
        require(totalRaised < goal, "Goal reached");
        require(amount > 0, "Invalid amount");

        uint256 remaining = goal - totalRaised;
        require(amount <= remaining, "Exceeds goal");

        // EFFECTS
        contributions[msg.sender] += amount;
        totalRaised += amount;

        // INTERACTION
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit Contribution(address(this), msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                FINALIZE
    //////////////////////////////////////////////////////////////*/

    function finalize() external nonReentrant {
        require(block.timestamp >= deadline, "Campaign active");
        require(!finalized, "Already finalized");

        finalized = true;

        if (totalRaised >= goal) {
            successful = true;
        }

        emit CampaignFinalized(address(this), successful);
    }

    /*//////////////////////////////////////////////////////////////
                              CLAIM FUNDS
    //////////////////////////////////////////////////////////////*/

    function claimFunds() external nonReentrant {
        require(finalized, "Not finalized");
        require(successful, "Campaign failed");
        require(msg.sender == creator, "Not creator");

        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No funds");

        // EFFECTS
        totalRaised = 0;

        // INTERACTION
        usdc.safeTransfer(creator, balance);

        emit FundsClaimed(address(this), creator, balance);
    }

    /*//////////////////////////////////////////////////////////////
                               REFUND
    //////////////////////////////////////////////////////////////*/

    function claimRefund() external nonReentrant {
        require(finalized, "Not finalized");
        require(!successful, "Campaign succeeded");

        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "Nothing to refund");

        // EFFECTS
        contributions[msg.sender] = 0;

        // INTERACTION
        usdc.safeTransfer(msg.sender, contributed);

        emit RefundClaimed(address(this), msg.sender, contributed);
    }

    /*//////////////////////////////////////////////////////////////
                               VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function timeLeft() external view returns (uint256) {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }

    function isActive() external view returns (bool) {
        return block.timestamp < deadline && !finalized;
    }

function getCampaignState() external view returns (uint8) {

    if (!finalized && block.timestamp < deadline && totalRaised < goal) {
        return 0; // ACTIVE
    }

    if (!finalized && block.timestamp < deadline && totalRaised >= goal) {
        return 1; // GOAL_REACHED
    }

    if (!finalized && block.timestamp >= deadline) {
        return 2; // AWAITING_FINALIZATION
    }

    if (finalized && successful && totalRaised > 0) {
        return 3; // SUCCESS
    }

    if (finalized && successful && totalRaised == 0) {
        return 4; // CLAIMED
    }

    return 5; // FAILED
}

}
