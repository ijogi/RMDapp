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
error NoSales();
error ERC721NotImplemented(address nftAddress, uint256 tokenId);

/// @title MarketPlace
/// @author Indrek Jõgi
/// @notice NFT Marketplace Smart Contract created for education purposes
contract MarketPlace is ReentrancyGuard {
    struct ListedItem {
        uint256 price;
        address seller;
    }

    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;

    mapping(address => mapping(uint256 => ListedItem)) private _listedItems;
    mapping(address => uint256) private _sales;

    modifier isTokenOwner(address nftAddress, uint256 tokenId, address caller) {
        IERC721 nft = IERC721(nftAddress);
        if (!nft.supportsInterface(INTERFACE_ID_ERC721)) {
          revert ERC721NotImplemented(nftAddress, tokenId);
        }
        address owner = nft.ownerOf(tokenId);
        if (caller != owner) {
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

    /// @notice listItem takes an approved NFT and lists it for sale and
    /// @notice Only the owner of an approved NFT can list an unlisted NFT
    /// @dev Doesn't currently implement the ERC1155 standard
    /// @param nftAddress The address of the NFT contract where the item belongs to
    /// @param tokenId Token ID of the individual NFT in the collection
    /// @param price The selling price for the NFT in Wei
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

    /// @notice buyItem transfers purchased NFT to buyers account 
    /// @param nftAddress The address of the NFT contract where the item belongs to
    /// @param tokenId Token ID of the individual NFT in the collection
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
        _sales[item.seller] += msg.value;
        delete _listedItems[nftAddress][tokenId];
        IERC721(nftAddress).safeTransferFrom(item.seller, msg.sender, tokenId);
    }

    /// @notice cancelListing delists an NFT for sale 
    /// @param nftAddress The address of the NFT contract where the item belongs to
    /// @param tokenId Token ID of the individual NFT in the collection
    function cancelListing(address nftAddress, uint256 tokenId) 
        external 
        isTokenOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete _listedItems[nftAddress][tokenId];
    }

    /// @notice cancelListing delists an NFT for sale 
    /// @param nftAddress The address of the NFT contract where the item belongs to
    /// @param tokenId Token ID of the individual NFT in the collection
    /// @param newPrice New price for the NFT
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

    /// @notice withdraw send sale proceedes to the seller 
    function withdraw() external {
        uint256 amount = _sales[msg.sender];
        if (amount <= 0) {
            revert NoSales();
        }
        _sales[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }

    /// @notice getListedItem shows details of a listed item 
    /// @param nftAddress The address of the NFT contract where the item belongs to
    /// @param tokenId Token ID of the individual NFT in the collection
    /// @return ListedItem containing price and seller's address
    function getListedItem(address nftAddress, uint256 tokenId) 
        external 
        view 
        returns (ListedItem memory)
    {
      return _listedItems[nftAddress][tokenId];
    }
}
