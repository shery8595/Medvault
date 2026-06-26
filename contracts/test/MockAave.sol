// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/// @dev TEST ONLY — never deploy to production networks.
contract MockAave {
    mapping(address => uint256) public balances;
    
    function depositETH(address /* pool */, address onBehalfOf, uint16 /* referralCode */) external payable {
        balances[onBehalfOf] += msg.value;
    }

    function withdrawETH(address /* pool */, uint256 amount, address to) external {
        require(balances[msg.sender] >= amount, "Insufficient aWETH");
        balances[msg.sender] -= amount;
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    function approve(address /* spender */, uint256 /* amount */) external pure returns (bool) {
        return true;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(balances[sender] >= amount, "Insufficient aWETH");
        balances[sender] -= amount;
        balances[recipient] += amount;
        return true;
    }

    receive() external payable {}

    /** @dev Test helper: credit aWETH balance without going through the gateway. */
    function testCredit(address account, uint256 amount) external {
        balances[account] += amount;
    }
}
