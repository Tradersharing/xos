// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Tswap is ERC20, Ownable {
    constructor() ERC20("Tradersharing Swap", "Tswap") {
        _mint(msg.sender, 100_000_000 * 10 ** decimals()); // ✅ 100 juta Tswap
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
