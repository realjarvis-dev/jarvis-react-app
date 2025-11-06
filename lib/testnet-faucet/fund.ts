import { ethers, JsonRpcProvider, TransactionResponse, Wallet } from 'ethers'
import { TENDERLY_DEMO_CONFIG } from '../network/config'

/**
 * Send test ETH on a public testnet (e.g., Sepolia) from a faucet wallet.
 * Requires SEPOLIA_FAUCET_PRIVATE_KEY to be set and funded with test ETH.
 *
 * @param recipientAddress EVM address to receive funds
 * @param amountInWei Amount in wei as bigint
 */
export async function addBalanceTestnet(
  recipientAddress: string,
  amountInWei: bigint
): Promise<TransactionResponse> {
  const faucetPk = process.env.SEPOLIA_FAUCET_PRIVATE_KEY
  if (!faucetPk) {
    throw new Error('SEPOLIA_FAUCET_PRIVATE_KEY is not set. Cannot fund on Sepolia.')
  }

  const rpcUrl = TENDERLY_DEMO_CONFIG.rpcUrl
  const provider = new JsonRpcProvider(rpcUrl)

  const wallet = new Wallet(faucetPk, provider)
  const balance = await provider.getBalance(wallet.address)

  if (balance < amountInWei) {
    throw new Error(
      `Faucet wallet balance too low. Faucet: ${wallet.address}, Balance: ${ethers.formatEther(
        balance
      )} ETH, Required: ${ethers.formatEther(amountInWei)} ETH`
    )
  }

  console.log(
    `Sending ${ethers.formatEther(amountInWei)} ETH from faucet ${wallet.address} to ${recipientAddress} on ${rpcUrl}`
  )

  const tx = await wallet.sendTransaction({
    to: recipientAddress,
    value: amountInWei
  })

  console.log(`Faucet transfer hash: ${tx.hash}`)
  return tx
}
