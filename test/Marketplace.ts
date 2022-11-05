import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"

describe("Marketplace", () => {

  async function deployMarketplaceFixtureWithNft() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount, royaltyAccount] = await ethers.getSigners()
    const tokenUri = "https://ipfs.io/ipfs/smth"

    const RobotMuralist = await ethers.getContractFactory("RobotMuralist")
    const robotMuralist = await RobotMuralist.deploy()

    const Marketplace = await ethers.getContractFactory("MarketPlace")
    const marketplace = await Marketplace.deploy()

    const ERC1155Token = await ethers.getContractFactory("MyToken")
    const erc1155Token = await ERC1155Token.deploy()

    const nftAddress = robotMuralist.address
    const marketplaceAddress = marketplace.address
    const price1Eth = ethers.utils.parseUnits("1", "ether")

    const tokenIdApproved = 0
    const tokenIdUnapproved = 1
    const tokenIdRoyalties = 2

    // Mint 1st NFT and grant access to Marketplace
    await robotMuralist.safeMint(owner.address, tokenUri)
    await robotMuralist.approve(marketplaceAddress, tokenIdApproved)
    // Mint 2nd NFT withold approval
    await robotMuralist.safeMint(owner.address, tokenUri)
    // Mint 3rd NFT with approval and royalties
    await robotMuralist.safeMint(owner.address, tokenUri)
    await robotMuralist.setTokenRoyalty(tokenIdRoyalties, royaltyAccount.address, 10000)
    await robotMuralist.approve(marketplaceAddress, tokenIdRoyalties)

    return {
      marketplace,
      robotMuralist,
      nftAddress,
      marketplaceAddress,
      owner,
      otherAccount,
      royaltyAccount,
      tokenUri,
      erc1155Token,
      price1Eth,
      tokenIdApproved,
      tokenIdUnapproved,
      tokenIdRoyalties,
    }
  }

  describe("listItem", () => {

    it("Should list a valid item and emit ItemListed event", async () => {
      const {
        marketplace,
        nftAddress,
        owner,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await expect(marketplace.listItem(nftAddress, tokenIdApproved, price1Eth))
        .to
        .emit(marketplace, "ItemListed")
        .withArgs(owner.address, nftAddress, tokenIdApproved, price1Eth)
    })

    it("Should revert when item is already listed", async () => {
      const {
        marketplace,
        nftAddress,
        price1Eth,
        tokenIdApproved 
      } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)
  
      await expect(marketplace.listItem(nftAddress, tokenIdApproved, price1Eth))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemAlreadyListed")
    })

    it("Should revert if not address is not an ERC721 NFT", async () => {
      const {
        marketplace,
        erc1155Token,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await expect(marketplace.listItem(erc1155Token.address, tokenIdApproved, price1Eth))
        .to
        .be
        .revertedWithCustomError(marketplace, "ERC721NotImplemented")
    })
  
    it("Should revert when function caller is not the owner of the item", async () => {
      const {
        marketplace,
        nftAddress,
        otherAccount,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.connect(otherAccount).listItem(nftAddress, tokenIdApproved, price1Eth))
        .to
        .be
        .revertedWithCustomError(marketplace, "NotTokenOwner")
    })
  
    it("Should revert when NFT price is 0 or negative", async () => {
      const {
        marketplace,
        nftAddress,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.listItem(nftAddress, tokenIdApproved, 0))
        .to
        .be
        .revertedWithCustomError(marketplace, "PriceMustBeAboveZero")
    })
  
    it("Should revert when when NFT is not approved for transfer", async () => {
      const {
        marketplace,
        nftAddress,
        price1Eth,
        tokenIdUnapproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.listItem(nftAddress, tokenIdUnapproved, price1Eth))
        .to
        .be
        .revertedWithCustomError(marketplace, "NftNotApprovedForMarketplace")
    })
  })

  describe("buyItem", () => {

    it("Should transfer NFT when price is met", async () => {
      const { 
        marketplace,
        robotMuralist,
        nftAddress,
        otherAccount,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)

      await expect(marketplace.connect(otherAccount).buyItem(nftAddress, 0, {
        value: price1Eth
      }))
        .emit(marketplace, "ItemBought")
        .withArgs(otherAccount.address, nftAddress, tokenIdApproved, price1Eth)

      expect(await robotMuralist.balanceOf(otherAccount.address)).to.equal(1)
    })

    it("Should revert when value does not match price", async () => {
      const {
        marketplace, 
        nftAddress,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)
  
      await expect(marketplace.buyItem(nftAddress, tokenIdApproved, {
        value: ethers.utils.parseUnits("0.33", "ether")
      }))
        .to
        .be
        .revertedWithCustomError(marketplace, "ValueDoesNotMatchPrice")
    })

    it("Should revert when NFT is not listed", async () => {
      const {
        marketplace,
        nftAddress,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.buyItem(nftAddress, tokenIdApproved, {
        value: price1Eth
      }))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemNotListed")
    })
  })

  describe("cancelListing", () => {

    it("Should cancel a listing for token owner", async () => {
      const {
        marketplace,
        nftAddress,
        price1Eth,
        owner,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)

      await expect(marketplace.cancelListing(nftAddress, tokenIdApproved))
        .to
        .emit(marketplace, "ListingCancelled")
        .withArgs(owner.address, nftAddress, tokenIdApproved)
    })

    it("Should revert when caller is not token owner", async () => {
      const {
        marketplace,
        nftAddress,
        otherAccount,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)

      await expect(marketplace.connect(otherAccount).cancelListing(nftAddress, tokenIdApproved))
        .to
        .be
        .revertedWithCustomError(marketplace, "NotTokenOwner")
    })

    it("Should revert when NFT is not listed", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.cancelListing(nftAddress, 0))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemNotListed")
    })
  })

  describe("updateItemPrice", () => {
  
    it("Should allow token owner to update it's price", async () => {
      const {
        marketplace,
        nftAddress,
        price1Eth,
        owner,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)
      const newPrice = ethers.utils.parseUnits("2", "ether")

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)

      await expect(marketplace.updateItemPrice(nftAddress, tokenIdApproved, newPrice))
        .to
        .emit(marketplace, "PriceUpdated")
        .withArgs(owner.address, nftAddress, tokenIdApproved, newPrice)
      
        const item = await marketplace.getListedItem(nftAddress, tokenIdApproved)
      expect(item.price).to.equal(newPrice)
    })

    it("Should revert when caller is not token owner", async () => {
      const {
        marketplace,
        nftAddress,
        otherAccount,
        price1Eth, 
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)
      const newPrice = ethers.utils.parseUnits("2", "ether")

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)

      await expect(marketplace.connect(otherAccount).updateItemPrice(nftAddress, tokenIdApproved, newPrice))
        .to
        .be
        .revertedWithCustomError(marketplace, "NotTokenOwner")
    })

    it("Should revert when NFT is not listed", async () => {
      const { marketplace, nftAddress, tokenIdApproved } = await loadFixture(deployMarketplaceFixtureWithNft)
      const newPrice = ethers.utils.parseUnits("2", "ether")
  
      await expect(marketplace.updateItemPrice(nftAddress, tokenIdApproved, newPrice))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemNotListed")
    })
  })

  describe("withdraw", () => {

    it("Should allow to withdraw proceeds from the sale", async () => {
      const {
        marketplace,
        nftAddress,
        otherAccount,
        owner,
        price1Eth,
        tokenIdApproved
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdApproved, price1Eth)
      await marketplace.connect(otherAccount).buyItem(nftAddress, tokenIdApproved, {
        value: price1Eth
      })
      const balance = await otherAccount.getBalance()

      await expect(marketplace.withdraw())
        .to
        .emit(marketplace, "FundsWithdrawn")
        .withArgs(owner.address, price1Eth)

      expect(await owner.getBalance())
        .to
        .be
        .greaterThanOrEqual(balance.add(price1Eth).toString())
    })

    it("Should revert if there are no sales proceeds", async () => {
      const { marketplace } = await loadFixture(deployMarketplaceFixtureWithNft)

      await expect(marketplace.withdraw()).to.be.revertedWithCustomError(marketplace, "NoSales")
    })

    it("Should revert if there are unpaid royalties", async () => {
      const {
        marketplace,
        nftAddress,
        price1Eth,
        tokenIdRoyalties
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdRoyalties, price1Eth)
      await marketplace.buyItem(nftAddress, tokenIdRoyalties, { value: price1Eth })

      await expect(marketplace.withdraw()).to.be.revertedWithCustomError(marketplace, "UnpaidRoyalties")
    })
  })

  describe("payRoyalties", () => {
    it("Should pay out any outstanding royalties", async () => {
      const {
        marketplace,
        nftAddress,
        royaltyAccount,
        price1Eth,
        tokenIdRoyalties
      } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, tokenIdRoyalties, price1Eth)
      await marketplace.buyItem(nftAddress, tokenIdRoyalties, { value: price1Eth })

      await expect(marketplace.payRoyalties())
        .to
        .emit(marketplace, "RoyaltyPaid")
        .withArgs(royaltyAccount.address, price1Eth)
    })
  })

})
