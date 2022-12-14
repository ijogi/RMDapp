import React, { useEffect, useState } from "react"
import { ethers } from "ethers"
import "./App.css"
import RobotMuralist from "./artifacts/contracts/RobotMuralist.sol/RobotMuralist.json"

const ROBOTMURALIST_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
const MARKETPLACE_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

function App() {
  type extendedWindow = Window & typeof globalThis & { ethereum: any }

  const [accounts, setAccounts] = useState([])
  const [provider] = useState(new ethers.providers.Web3Provider((window as extendedWindow).ethereum))
  const [address, setAddress] = useState("")
  const [tokenUri, setTokenUri] = useState("")

  console.log(RobotMuralist)

  useEffect(() => {
    async function connectToMetamask() {
      setAccounts(await provider.send("eth_requestAccounts", []))
    }

    connectToMetamask()
  }, [provider])

  async function mintNft() {
    const signer = provider.getSigner()
    const contract = new ethers.Contract(ROBOTMURALIST_ADDRESS, RobotMuralist.abi, signer)
    await contract.safeMint(address, tokenUri)
  }

  return (
    <div className="App">
      <header className="App-header">
        RobotMuralist &nbsp;
        { accounts }

        <section>
          <div>
            <label htmlFor="address">Adddress to:</label>
            <input type="text" name="address" id="address" onChange={(e) => setAddress(e.target.value)}/>
          </div>
          <div>
            <label htmlFor="tokenUri">Token URI:</label>
            <input type="text" name="tokenUri" id="tokenUri" onChange={(e) => setTokenUri(e.target.value)}/>
          </div>
          <button onClick={async () => await mintNft()}>Mint NFT</button>
        </section>
      </header>

    </div>
  )
}

export default App;
