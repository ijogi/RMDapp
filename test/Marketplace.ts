import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Marketplace", () => {

  async function deployMarketplaceFixtureWithNft() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners()
    const tokenUri = "https://ipfs.io/ipfs/smth"

    const RobotMuralist = await ethers.getContractFactory("RobotMuralist")
    const robotMuralist = await RobotMuralist.deploy()

    const Marketplace = await ethers.getContractFactory("MarketPlace")
    const marketplace = await Marketplace.deploy()

    const ERC1155Token = await ethers.getContractFactory("MyToken")
    const erc1155Token = await ERC1155Token.deploy()

    const nftAddress = robotMuralist.address
    const marketplaceAddress = marketplace.address

    // Mint 1st NFT and grant access to Marketplace
    await robotMuralist.safeMint(owner.address, tokenUri)
    await robotMuralist.approve(marketplaceAddress, 0)
    // Mint 2nd NFT withold approval
    await robotMuralist.safeMint(owner.address, tokenUri)

    return {
      marketplace,
      robotMuralist,
      nftAddress,
      marketplaceAddress,
      owner,
      otherAccount,
      tokenUri,
      erc1155Token,
    }
  }

  describe("listItem", () => {

    it("Should list a valid item", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)

      expect(await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether")))
        .not
        .to
        .be
        .reverted
    })

    it("Should revert when item is already listed", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))
  
      await expect(marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether")))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemAlreadyListed")
    })

    it("Should revert if not address is not an ERC721 NFT", async () => {
      const { marketplace, erc1155Token } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await expect(marketplace.listItem(erc1155Token.address, 0, ethers.utils.parseUnits("1", "ether")))
        .to
        .be
        .revertedWithCustomError(marketplace, "ERC721NotImplemented")
    })
  
    it("Should revert when function caller is not the owner of the item", async () => {
      const { marketplace, nftAddress, otherAccount } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.connect(otherAccount).listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether")))
        .to
        .be
        .revertedWithCustomError(marketplace, "NotTokenOwner")
    })
  
    it("Should revert when NFT price is 0 or negative", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.listItem(nftAddress, 0, 0))
        .to
        .be
        .revertedWithCustomError(marketplace, "PriceMustBeAboveZero")
    })
  
    it("Should revert when when NFT is not approved for transfer", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.listItem(nftAddress, 1, ethers.utils.parseUnits("1", "ether")))
        .to
        .be
        .revertedWithCustomError(marketplace, "NftNotApprovedForMarketplace")
    })
  })

  describe("buyItem", () => {

    it("Should transfer NFT when price is met", async () => {
      const { marketplace, robotMuralist, nftAddress, otherAccount } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))

      await marketplace.connect(otherAccount).buyItem(nftAddress, 0, {
        value: ethers.utils.parseUnits("1", "ether")
      })

      expect(await robotMuralist.balanceOf(otherAccount.address)).to.equal(1)
    })

    it("Should revert when value does not match price", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))
  
      await expect(marketplace.buyItem(nftAddress, 0, {
        value: ethers.utils.parseUnits("0.33", "ether")
      }))
        .to
        .be
        .revertedWithCustomError(marketplace, "ValueDoesNotMatchPrice")
    })

    it("Should revert when NFT is not listed", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)
  
      await expect(marketplace.buyItem(nftAddress, 0, {
        value: ethers.utils.parseUnits("1", "ether")
      }))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemNotListed")
    })
  })

  describe("cancelListing", () => {

    it("Should cancel a listing for token owner", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))

      expect(await marketplace.cancelListing(nftAddress, 0))
        .not
        .to
        .be
        .reverted
    })

    it("Should revert when caller is not token owner", async () => {
      const { marketplace, nftAddress, otherAccount } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))

      await expect(marketplace.connect(otherAccount).cancelListing(nftAddress, 0))
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
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)
      const newPrice = ethers.utils.parseUnits("2", "ether")

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))
      await marketplace.updateItemPrice(nftAddress, 0, newPrice)
      const item = await marketplace.getListedItem(nftAddress, 0)

      expect(item.price).to.equal(newPrice)
    })

    it("Should revert when caller is not token owner", async () => {
      const { marketplace, nftAddress, otherAccount } = await loadFixture(deployMarketplaceFixtureWithNft)
      const newPrice = ethers.utils.parseUnits("2", "ether")

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))

      await expect(marketplace.connect(otherAccount).updateItemPrice(nftAddress, 0, newPrice))
        .to
        .be
        .revertedWithCustomError(marketplace, "NotTokenOwner")
    })

    it("Should revert when NFT is not listed", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft)
      const newPrice = ethers.utils.parseUnits("2", "ether")
  
      await expect(marketplace.updateItemPrice(nftAddress, 0, newPrice))
        .to
        .be
        .revertedWithCustomError(marketplace, "ItemNotListed")
    })
  })

  describe("withdraw", () => {

    it("Should allow to withdraw proceeds from the sale", async () => {
      const { marketplace, nftAddress, otherAccount, owner } = await loadFixture(deployMarketplaceFixtureWithNft)

      await marketplace.listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether"))
      await marketplace.connect(otherAccount).buyItem(nftAddress, 0, {
        value: ethers.utils.parseUnits("1", "ether")
      })
      const balance = await otherAccount.getBalance()
      await marketplace.withdraw()

      expect(await owner.getBalance()).to.be.greaterThanOrEqual(balance.add(ethers.utils.parseUnits("1", "ether")).toString()).to.not.be.reverted
    })

    it("Should revert if there are no sales proceeds", async () => {
      const { marketplace } = await loadFixture(deployMarketplaceFixtureWithNft)

      await expect(marketplace.withdraw()).to.be.revertedWithCustomError(marketplace, "NoSales")
    })
  })

})
