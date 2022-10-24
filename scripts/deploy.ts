import { ethers } from "hardhat";

async function main() {
  const RobotMuralist = await ethers.getContractFactory("RobotMuralist");
  const robotMuralist = await RobotMuralist.deploy();

  await robotMuralist.deployed();

  console.log(`Robot Muralist ERC-721 contract deployed to ${robotMuralist.address}`);

  const Marketplace = await ethers.getContractFactory("MarketPlace");
  const marketplace = await Marketplace.deploy();

  await marketplace.deployed();
  console.log(`NFT marketplace contract deployed to ${marketplace.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
