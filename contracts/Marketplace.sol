// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NotTokenOwner(address nftAddress, uint256 tokenId);
error ItemNotListed(address nftAddress, uint256 tokenId);
error ItemAlreadyListed(address nftAddress, uint256 tokenId);
error PriceMustBeAboveZero(uint256 price);
error ValueDoesNotMatchPrice(address nftAddress, uint256 tokenId, uint256 price);
error NftNotApprovedForMarketplace(address nftAddress, uint256 tokenId);
error NoSales();
error ERC721NotImplemented(address nftAddress, uint256 tokenId);
error UnpaidRoyalties();

/// @title MarketPlace
/// @notice NFT Marketplace Smart Contract created for educational purposes
contract MarketPlace is ReentrancyGuard {
    struct ListedItem {
        uint256 price;
        address seller;
    }

    struct Royalty {
      address receiver;
      uint256 amount;
    }

    event ItemListed(
      address indexed owner,
      address indexed nftAddress,
      uint256 tokenId, 
      uint256 price
    );

    event ItemBought(
      address indexed buyer,
      address indexed nftAddress,
      uint256 tokenId, 
      uint256 price
    );

    event ListingCancelled(
      address indexed owner,
      address indexed nftAddress,
      uint256 tokenId
    );

    event PriceUpdated(
      address indexed buyer,
      address indexed nftAddress,
      uint256 tokenId, 
      uint256 newPrice
    );

    event FundsWithdrawn(
      address indexed seller,
      uint256 amount
    );

    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    mapping(address => mapping(uint256 => ListedItem)) private _listedItems;
    mapping(address => uint256) private _sales;
    mapping(address => Royalty[]) private _registeredRoyalties;

    modifier isTokenOwner(address nftAddress, uint256 tokenId, address caller) {
        IERC721 nft = IERC721(nftAddress);
        if (!nft.supportsInterface(_INTERFACE_ID_ERC721)) {
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

    modifier royaltiesPaid() {
        Royalty[] memory royaltiesForSeller = _registeredRoyalties[msg.sender];
        if (royaltiesForSeller.length > 0) {
            revert UnpaidRoyalties();
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
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
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
        uint256 royaltyProceeds = _registerRoyalty(nftAddress, tokenId, item.price);
        _sales[item.seller] += msg.value - royaltyProceeds;
        delete _listedItems[nftAddress][tokenId];
        IERC721(nftAddress).safeTransferFrom(item.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, item.price);
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
        emit ListingCancelled(msg.sender, nftAddress, tokenId);
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
        emit PriceUpdated(msg.sender, nftAddress, tokenId, newPrice);
    }

    /// @notice withdraw send sale proceedes to the seller 
    function withdraw() external royaltiesPaid {
        uint256 amount = _sales[msg.sender];
        if (amount <= 0) {
            revert NoSales();
        }
        _sales[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        emit FundsWithdrawn(msg.sender, amount);
    }

    function payRoyalties() external {
        Royalty[] storage royaltiesForSeller = _registeredRoyalties[msg.sender];
        for (uint256 i = 0; i < royaltiesForSeller.length; i++) {
            address receiver = royaltiesForSeller[i].receiver;
            uint256 amount = royaltiesForSeller[i].amount;
            delete royaltiesForSeller[i];
            (bool success, ) = payable(receiver).call{value: amount}("");
            require(success, "Transfer failed");
        }
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

    /// @notice getAvailableProceeds returns available sales proceeds
    /// @return The amount of available proceeds
    function getAvailableProceeds()
        external
        view
        returns (uint256) 
    {
        return _sales[msg.sender];
    }

    function _registerRoyalty(address nftAddress, uint256 tokenId, uint256 salePrice) private returns (uint256) {
        address receiver = address(0);
        uint256 royaltyAmount = 0;
        IERC2981 nftWithRoyalties = IERC2981(nftAddress);
        if (nftWithRoyalties.supportsInterface(_INTERFACE_ID_ERC2981)) {
            (receiver, royaltyAmount) = nftWithRoyalties.royaltyInfo(tokenId, salePrice);
            if (royaltyAmount > 0) {
                Royalty[] storage royaltiesForSeller = _registeredRoyalties[msg.sender];
                royaltiesForSeller.push(Royalty(receiver, royaltyAmount));
                _registeredRoyalties[msg.sender] = royaltiesForSeller;
            }
        }
        return royaltyAmount;
    }
}
