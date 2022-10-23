import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("RobotMuralist", () => {
  async function deployRobotMuralistFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners()
    const tokenUri = "https://ipfs.io/ipfs/smth"

    const RobotMuralist = await ethers.getContractFactory("RobotMuralist")
    const robotMuralist = await RobotMuralist.deploy()

    return { robotMuralist, owner, otherAccount, tokenUri }
  }

  describe("Deployment", () => {
    it("Should assign deploying address as owner", async () => {
      const { robotMuralist, owner } = await loadFixture(deployRobotMuralistFixture)
      expect(await robotMuralist.owner()).to.equal(owner.address);
    })
  })

  describe("safeMint", () => {
    it("Should mint an NFT to a specified address", async () => {
      const { robotMuralist, otherAccount, tokenUri } = await loadFixture(deployRobotMuralistFixture)

      expect(await robotMuralist.safeMint(otherAccount.address, tokenUri)).not.to.be.reverted
    })

    it("Should revert when not the owner attempts to mint", async () => {
      const { robotMuralist, otherAccount, tokenUri } = await loadFixture(deployRobotMuralistFixture)

      await expect(robotMuralist.connect(otherAccount).safeMint(otherAccount.address, tokenUri)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      )
    })
  })

  describe("TokenUri", () => {
    it("Should return the token URI of a minted token", async () => {
      const { robotMuralist, otherAccount, tokenUri } = await loadFixture(deployRobotMuralistFixture)
      
      await robotMuralist.safeMint(otherAccount.address, tokenUri)

      expect(await robotMuralist.tokenURI(0)).to.equal(tokenUri)
    })
  })
})
