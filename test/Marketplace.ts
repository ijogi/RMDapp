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

    const nftAddress = robotMuralist.address
    const marketplaceAddress = marketplace.address

    // Mint 1st NFT and grant access to Marketplace
    await robotMuralist.safeMint(owner.address, tokenUri)
    await robotMuralist.approve(marketplaceAddress, 0)
    // Mint 2nd NFT withold approval
    await robotMuralist.safeMint(owner.address, tokenUri)

    return { marketplace, nftAddress, marketplaceAddress, owner, otherAccount, tokenUri }
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
  
    it("Should revert when function caller is not the owner of the item", async () => {
      const { marketplace, nftAddress, otherAccount } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await expect(marketplace.connect(otherAccount).listItem(nftAddress, 0, ethers.utils.parseUnits("1", "ether")))
        .to
        .be
        .revertedWithCustomError(marketplace, "NotTokenOwner")
    })
  
    it("Should revert when NFT price is 0 or negative", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await expect(marketplace.listItem(nftAddress, 0, 0))
        .to
        .be
        .revertedWithCustomError(marketplace, "PriceMustBeAboveZero")
    })
  
    it("Should revert when when NFT is not approved for transfer", async () => {
      const { marketplace, nftAddress } = await loadFixture(deployMarketplaceFixtureWithNft);
  
      await expect(marketplace.listItem(nftAddress, 1, ethers.utils.parseUnits("1", "ether")))
        .to
        .be
        .revertedWithCustomError(marketplace, "NftNotApprovedForMarketplace")
    })
  })

})
