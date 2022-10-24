// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NotTokenOwner(address nftAddress, uint256 tokenId);
error ItemNotListed(address nftAddress, uint256 tokenId);
error ItemAlreadyListed(address nftAddress, uint256 tokenId);
error PriceMustBeAboveZero(uint256 price);
error ValueDoesNotMatchPrice(address nftAddress, uint256 tokenId, uint256 price);
error NftNotApprovedForMarketplace(address nftAddress, uint256 tokenId);

contract MarketPlace is ReentrancyGuard {
    struct ListedItem {
        uint256 price;
        address seller;
    }

    mapping(address => mapping(uint256 => ListedItem)) private _listedItems;

    modifier isTokenOwner(address nftAddress, uint256 tokenId, address initiator) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (initiator != owner) {
            revert NotTokenOwner(nftAddress, tokenId);
        }
        _;
    }

    modifier notListed(address nftAddress, uint256 tokenId) {
        ListedItem memory item = _listedItems[nftAddress][tokenId];
        if (item.price > 0) {
            revert ItemAlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        ListedItem memory item = _listedItems[nftAddress][tokenId];
        if (item.price <= 0) {
            revert ItemNotListed(nftAddress, tokenId);
        }
        _;
    }

    function listItem(address nftAddress, uint256 tokenId, uint256 price) 
        external 
        notListed(nftAddress, tokenId) 
        isTokenOwner(nftAddress, tokenId, msg.sender) 
    {
        if (price <= 0) {
            revert PriceMustBeAboveZero(price);
        }
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftNotApprovedForMarketplace(nftAddress, tokenId);
        }
        _listedItems[nftAddress][tokenId] = ListedItem(price, msg.sender);
    }

    function buyItem(address nftAddress, uint256 tokenId)
        external 
        payable 
        isListed(nftAddress, tokenId)
        nonReentrant
    {
        ListedItem memory item = _listedItems[nftAddress][tokenId];
        if (msg.value < item.price) {
            revert ValueDoesNotMatchPrice(nftAddress, tokenId, item.price);
        }
        (bool success, ) = payable(msg.sender).call{value: msg.value}("");
        require(success, "Transfer failed");
        delete _listedItems[nftAddress][tokenId];
        IERC721(nftAddress).safeTransferFrom(item.seller, msg.sender, tokenId);
    }

    function cancelListing(address nftAddress, uint256 tokenId) 
        external 
        isTokenOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete _listedItems[nftAddress][tokenId];
    }

    function updateItemPrice(address nftAddress, uint256 tokenId, uint256 newPrice) 
        external 
        isTokenOwner(nftAddress, tokenId, msg.sender) 
        isListed(nftAddress, tokenId)
    {
        if (newPrice <= 0) {
            revert PriceMustBeAboveZero(newPrice);
        }
        _listedItems[nftAddress][tokenId].price = newPrice;
    }
}
