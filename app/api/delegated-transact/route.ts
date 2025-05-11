import { NextRequest, NextResponse } from "next/server";
import { PrivyClient, AuthTokenClaims } from "@privy-io/server-auth";
import { getUserEvmWalletAddress, getUserSolWalletAddress, getUserWallet, privy } from "@/lib/privy/client";
import { WalletWithMetadata } from "@privy-io/server-auth";
import { fetchEthUsdPrice } from "@/lib/tools/privy-transfer";
import { ethers } from "ethers";

export async function GET(req: NextRequest) {

  const evmWallet: WalletWithMetadata | undefined = await getUserWallet('ethereum');
  
  if (!evmWallet?.delegated) {
    return NextResponse.json({ error: "Not delegated" }, { status: 401 });
  }

  if (!evmWallet) {
    return NextResponse.json({ error: "No evm wallet" }, { status: 401 });
  }
  try {


    const weiBig = BigInt("1000000000000000000");
    const hex = ethers.toQuantity(weiBig);
    console.log("hex", hex)

    const {signature, encoding} = await privy.walletApi.ethereum.signMessage({
        walletId: evmWallet?.id || '',
        message: 'Hello world'
    });
    const { price, decimals } = await fetchEthUsdPrice();
    console.log('Price: ', price, 'Decimals: ', decimals);

    const { hash } = await privy.walletApi.ethereum.sendTransaction({
        walletId: evmWallet?.id || '',
        caip2: `eip155:11155111`,
        transaction: {
        to: '0xa9516C8AA7425D6190345a038eB8C4799C786Bb8',
        value: 1,   
        chainId: 11155111                   
        },
        idempotencyKey: 'unique-key=' // unique key for this transaction

    });
    console.log('Transaction send, hash: ', hash);
      
      
    return NextResponse.json({ hash }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error signing message" }, { status: 401 });
  }


}
