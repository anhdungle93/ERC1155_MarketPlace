// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import "./ERC1155.sol";
// In this FreeERC1155 we allow anyone to mint any amount of ERC1155 for the testing purposes

contract FreeERC1155 is ERC1155 {
    function mint(address to, uint256 id, uint256 amount) public {
        _mint(to, id, amount, "");
    }
}
