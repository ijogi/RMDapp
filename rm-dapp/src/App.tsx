import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import './App.css'
import RobotMuralist from './artifacts/contracts/RobotMuralist.sol/RobotMuralist.json'

const ROBOTMURALIST_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

function App() {
  type extendedWindow = Window & typeof globalThis & { ethereum: any }
  type ethAddress = `0x${string}`
  const [accounts, setAccounts] = useState([])
  const [provider] = useState(new ethers.providers.Web3Provider((window as extendedWindow).ethereum))

  console.log(RobotMuralist)

  useEffect(() => {
    async function connectToMetamask() {
      setAccounts(await provider.send("eth_requestAccounts", []))
    }

    connectToMetamask()
  }, [provider])

  async function mintNft(addressTo: ethAddress, tokenUri: string) {
    const signer = provider.getSigner()
    const contract = new ethers.Contract(ROBOTMURALIST_ADDRESS, RobotMuralist.abi, signer)
    await contract.safeMint(addressTo, tokenUri)
  }

  return (
    <div className="App">
      <header className="App-header">
        RobotMuralist &nbsp;
        { accounts }

        <section>
          <button onClick={async () => await mintNft("0x069fdf69bfc74a59b1e452823a27d5fed7a0020a", "https://ipfs.io/ipfs/QmaXVg572hsAMDmzCg6KrFgnuSaCcrSmqYByfc4VtqvsGU")}>Mint NFT</button>
        </section>
      </header>

    </div>
  )
}

export default App;
