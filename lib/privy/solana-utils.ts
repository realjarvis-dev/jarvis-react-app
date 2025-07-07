import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import {
  Commitment,
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction
} from '@solana/web3.js'
import { getUserWallet, privy } from './client'

export async function signSolanaTransaction(transaction: Transaction | VersionedTransaction,
    connection: Connection
) {
    const wallet = await getUserWallet('solana')
    if (!wallet) {
        throw new Error('Wallet not found')
    }

    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash()
    if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.lastValidBlockHeight = lastValidBlockHeight
        transaction.feePayer = new PublicKey(wallet.address)
    } else {
        
    }

    // Get the signed transaction object from the response
    const { signedTransaction } = await privy.walletApi.solana.signTransaction({
        walletId: wallet.id!,
        transaction: transaction
    });

    return signedTransaction

}

/**
 * Sign a base64 encoded Solana transaction string
 * @param transaction - The transaction string to sign
 * @param connection - The Solana connection
 * @returns The signed transaction string in base64 format
 */

export async function signSolanaTransactionString(
  transaction: string,
  connection: Connection
) {
  const wallet = await getUserWallet('solana')
  if (!wallet) {
    throw new Error('Wallet not found')
  }
  const rawTxBase64 = transaction // e.g. "AQAAAAA…"

  const rawTxBytes = Buffer.from(rawTxBase64, 'base64')

  try {
    // Try to deserialize as a versioned transaction first
    const vtx = VersionedTransaction.deserialize(rawTxBytes)

    // For versioned transactions, we need to create a new VersionedTransaction
    // with the message and empty signatures array

    const signedTransaction = await signSolanaTransaction(vtx, connection)

    // const signedBase64 = Buffer.from(signedTransaction.serialize()).toString("base64");
    return signedTransaction
  } catch (err) {
    // Fall back to legacy transaction
    const tx = Transaction.from(rawTxBytes)

    const signedTransaction = await signSolanaTransaction(tx, connection)

    // const signedBase64 = Buffer.from(signedTransaction.serialize()).toString("base64");
    return signedTransaction
  }
}

/**
 * Broadcasts a signed Solana transaction to the network and waits for confirmation
 * using the new, non-deprecated APIs.
 *
 * @param signedTransaction  A signed transaction.
 * @param connection         The Solana Web3 Connection object.
 * @param commitment         (Optional) How “final” the confirmation should be. Defaults to 'confirmed'.
 * @returns                  The transaction signature (txid).
 */
export async function broadcastSolanaTransaction(
  signedTransaction: Transaction | VersionedTransaction,
  connection: Connection,
  commitment: Commitment = 'confirmed'
): Promise<string> {
  const rawTx = signedTransaction.serialize()

  const txid = await connection.sendRawTransaction(rawTx)

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash(commitment)

  await connection.confirmTransaction(
    { signature: txid, blockhash, lastValidBlockHeight },
    commitment
  )

  return txid
}

/**
 * Ensure the given owner has an ATA for the given mint.
 * If it already exists, this is a no-op.
 * @param connection Solana RPC connection
 * @param ownerAddress      Address of the token account owner (your wallet)
 * @param mintAddress       Address of the mint you need an ATA for
 * @returns the ATA PublicKey
 */
export async function ensureAta(
    connection: Connection,
    ownerAddress: string,
    mintAddress: string
  ): Promise<{ata: PublicKey, txid: string}> {
    const owner = new PublicKey(ownerAddress)
    const mint = new PublicKey(mintAddress)
    // Derive the ATA address
    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,               // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  
    // Check if it already exists on-chain
    const accountInfo = await connection.getAccountInfo(ata);
    if (accountInfo) {
      // ATA already exists
      return {ata, txid: ''};
    }
  
    // Build “create ATA” instruction
    const createIx = createAssociatedTokenAccountInstruction(
      owner,     // funding payer
      ata,                 // the ATA to create
      owner,               // the token account’s owner
      mint,                // the mint for this ATA
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  
    // Send transaction
    const tx = new Transaction().add(createIx);
    const signedTransaction = await signSolanaTransaction(tx, connection)
    const txid = await broadcastSolanaTransaction(signedTransaction, connection)
    console.log('Created ATA', ata.toBase58(), ' tx=', txid);
  
    return {ata, txid};
  }


