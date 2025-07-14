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
  TransactionInstruction,
  TransactionMessage,
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

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.lastValidBlockHeight = lastValidBlockHeight
        transaction.feePayer = new PublicKey(wallet.address)
            // Get the signed transaction object from the response
      const { signedTransaction } = await privy.walletApi.solana.signTransaction({
          walletId: wallet.id!,
          transaction: transaction
      });

      return signedTransaction

    } else {
      console.log("transaction.message.addressTableLookups.length", transaction.message.addressTableLookups.length)
      console.log("transaction.message.staticAccountKeys[0]", transaction.message.staticAccountKeys[0])
      if (transaction.message.addressTableLookups.length == 0) {
        const acctKeys = transaction.message.getAccountKeys();
    
        const ixns = transaction.message.compiledInstructions.map(ci =>
          new TransactionInstruction({
            programId: acctKeys.get(ci.programIdIndex)!,
            keys: ci.accountKeyIndexes.map(i => ({
              pubkey: acctKeys.get(i)!,
              isSigner: transaction.message.isAccountSigner(i),
              isWritable: transaction.message.isAccountWritable(i),
            })),
            data: Buffer.from(ci.data),
          })
        )
          const userWalletPubkey = new PublicKey(wallet.address)
          const { blockhash } = await connection.getLatestBlockhash()
          // 3) Build & compile a new V0 message
          const newMsg = new TransactionMessage({
            payerKey: userWalletPubkey,
            recentBlockhash: blockhash,
            instructions: ixns,
          }).compileToV0Message();

  
          // For versioned transactions, we need to create a new VersionedTransaction
          // with the message and empty signatures array
          const newVtx = new VersionedTransaction(newMsg);
          const { signedTransaction } = await privy.walletApi.solana.signTransaction({
            walletId: wallet.id!,
            transaction: newVtx
          });
          return signedTransaction
      } else {
        console.log("recent block hash", transaction.message.recentBlockhash)
        console.log("latest block hash", await connection.getLatestBlockhash())
        console.log("address table lookups", transaction.message.addressTableLookups)


            // Get the signed transaction object from the response
          const { signedTransaction } = await privy.walletApi.solana.signTransaction({
            walletId: wallet.id!,
            transaction: transaction
          });

          

          return signedTransaction 
      }


    }



}

/**
 * Sign a base64 encoded Solana transaction string
 * @param transaction - The transaction string to sign
 * @param connection - The Solana connection
 * @returns The signed transaction with type Transaction or VersionedTransaction
 */

export async function signSolanaTransactionString(
  transaction: string,
  connection: Connection
) {

  const rawTxBase64 = transaction // e.g. "AQAAAAA…"

  const rawTxBytes = Buffer.from(rawTxBase64, 'base64')

  try {
    // Try to deserialize as a versioned transaction first
    const vtx = VersionedTransaction.deserialize(rawTxBytes)
    
    const signedTransaction = await signSolanaTransaction(vtx, connection)
    console.log("versioned tx", JSON.stringify(vtx, null, 2))

    // const signedBase64 = Buffer.from(signedTransaction.serialize()).toString("base64");
    return signedTransaction
  } catch (err) {
    console.log("error:", err)
    // Fall back to legacy transaction
    const tx = Transaction.from(rawTxBytes)
    console.log("legacy tx", tx)
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
  // return "txid"
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
  
    return {ata, txid};
  }


