/ SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/* We inherit ERC1155Holder to include the implementation of 
functions `onERC1155Received()` and `onERC1155BatchReceived()`
without it we wouldn't be able to receive the tokens via safeTransferFrom */
contract MarketPlace is ERC1155Holder {

    struct SaleInfo {
        uint256 amount
        uint256 price
    }
    
    // from saleID to SaleInfo
    mapping (uint256 => SaleInfo) public inventory;

    event ListItem(
        address indexed seller,
        address indexed tokenAddress,
        uint256 id,
        uint256 amount,
        uint256 price
    )

    event RemoveItem(
        address indexed seller,
        address indexed tokenAddress,
        uint256 id,
        uint256 amount
    )

    event BuyItem(
        address indexed buyer,
        address indexed seller,
        address indexed tokenAddress,
        address id,
        address amount,
        address price
    )

    function listItem(address _tokenAddress, uint256 _id, uint256 _amount, uint256 _price) public {
        uint256 saleID = keccak256(abi.encode(msg.sender, _tokenAddress, _id));
        SaleInfo storage saleInfo = inventory[saleID];
        require(saleInfo.amount == 0, "MarketPlace: cancel existing listing first.");
        saleInfo.amount = _amount;
        saleInfo.price = _price;
        IERC1155(_tokenAddress).safeTransferFrom(msg.sender, address(this), _id, _amount, "");
        emit ListItem(msg.sender, _tokenAddress, );
    }

    function removeItem(address _tokenAddress, uint256 _id, uint256 _amount) public {
        require(_amount != 0, "MarketPlace: nothing to remove.");
        uint256 saleID = keccak256(abi.encode(msg.sender, _tokenAddress, _id));
        SaleInfo storage saleInfo = inventory[saleID];
        require(saleInfo.amount >= _amount, "MarketPlace: not enough to remove.");
        saleInfo.amount = saleInfo.amount - _amount;
        IERC1155(_tokenAddress).safeTransferFrom(address(this), msg.sender, _id, _amount, "");
        emit RemoveItem(msg.sender, _tokenAddress, _id, _amount);
    }

    function buyItem(address payable _seller, address _tokenAddress, uint256 _id, uint256 _amount) public {
        require(_amount != 0, "MarketPlace: nothing to buy.");
        uint saleID = keccak256(abi.encode(_seller, _tokenAddress, _id));
        SaleInfo storage saleInfo = inventory[saleID];
        require(saleInfo.amount >= _amount, "MarketPlace: not enough to sell.");
        uint _price = saleInfo.price;
        uint totalPrice = _price * _amount;
        require(msg.value >= totalPrice, "MarketPlace: not enought ETH to cover total price.");
        saleInfo.amount = saleInfo.amount - _amount;
        _seller.transfer(totalPrice);
        msg.sender.transfer(msg.value - totalPrice);
        emit BuyItem(msg.sender, _seller, _tokenAddress, _id, _amount, _price);
    }
}
