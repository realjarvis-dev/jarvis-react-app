import { Connection, Message, Transaction, VersionedMessage, VersionedTransaction } from "@solana/web3.js";

/**
 * Compute the network fee for a given transaction string
 * @param transactionString - The transaction string to compute the network fee for
 * @param connection - The connection to use to compute the network fee
 * @returns The network fee in lamports for the given transaction string
 */
export async function computeNetworkFeeFromTxString(transactionString: string,
    connection: Connection
) {
    let message: Message | VersionedMessage;
    const rawTxBase64 = transactionString;  // e.g. "AQAAAAA…"

    const rawTxBytes = Buffer.from(rawTxBase64, 'base64');

    try {
    const vtx = VersionedTransaction.deserialize(rawTxBytes);
    message = vtx.message;
    } catch (err) { 
    const tx = Transaction.from(rawTxBytes);
    message = tx.compileMessage();
    }
    return (await connection.getFeeForMessage(message)).value
}