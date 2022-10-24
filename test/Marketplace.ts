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

    await robotMuralist.safeMint(owner.address, tokenUri)
    await robotMuralist.approve(marketplaceAddress, 0)

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
  })
})
