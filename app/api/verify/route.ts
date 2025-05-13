import { NextRequest, NextResponse } from "next/server";
import { PrivyClient, AuthTokenClaims } from "@privy-io/server-auth";
import { getUserEvmWalletAddress, getUserSolWalletAddress, getUser } from "@/lib/privy/client";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const client = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!,
// {
//   walletApi: {
//     authorizationPrivateKey: process.env.PRIVY_SIGNING_KEY,
//   },
// }
);

export type AuthenticateSuccessResponse = {
  claims: AuthTokenClaims;
};

export type AuthenticationErrorResponse = {
  error: string;
};

export async function GET(req: NextRequest) {
  const headerAuthToken = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const cookieAuthToken = req.cookies.get("privy-token")?.value;
  const idToken = req.cookies.get("privy-id-token")?.value;
  console.log("idToken", idToken)
  const authToken = cookieAuthToken || headerAuthToken;
  if (!authToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }
  try {
    const claims = await client.verifyAuthToken(authToken);
    console.log("claims", claims)
    // const user = await client.getUser({idToken: idToken || ''});
    // console.log("user", user)
    const user = await getUser()
    console.log("user", user)
    const evm = await getUserEvmWalletAddress()
    const sol = await getUserSolWalletAddress()
    console.log("evm", evm)
    console.log("sol", sol)
    return NextResponse.json({ claims, evm, sol }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}