// lib/privy.ts
import { AuthTokenClaims, LinkedAccountWithMetadata, PrivyClient, User, WalletWithMetadata } from '@privy-io/server-auth'
import { cookies } from 'next/headers'
import Privy from '@privy-io/js-sdk-core'

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!
const appSecret = process.env.PRIVY_APP_SECRET!

export const privy = new PrivyClient(appId, appSecret, 
{
  walletApi: {
    authorizationPrivateKey: process.env.PRIVY_SIGNING_KEY,
  },
}
)

export async function verifyAccessToken(): Promise<AuthTokenClaims> {
  const cookieStore = await cookies()
  const token = cookieStore.get("privy-token")?.value
  if (!token) {
    throw new Error("No token found")
  }
  return privy.verifyAuthToken(token)
}

// Return user data in an identity token has to be turned on in the Privy dashboard
export async function getUser(): Promise<User> {
  const cookieStore = await cookies()
  // const idToken = cookieStore.get("privy-id-token")?.value
  // if (!idToken) {
  //   // throw new Error("No token found")
  //   // Fall back to auth token
  //   const token = cookieStore.get("privy-token")?.value
  //   if (!token) {
  //     throw new Error("No token found")
  //   }
  //   const claims = await privy.verifyAuthToken(token)
  //   const user = await privy.getUserById(claims.userId)


  //   return user
  // } else {
  //   const user = await privy.getUser({ idToken: idToken })
  //   return user
  // }

  // default to the auth token
  const token = cookieStore.get("privy-token")?.value
  if (!token) {
    throw new Error("No token found")
  }
  const claims = await privy.verifyAuthToken(token)
  const user = await privy.getUserById(claims.userId)
  return user
}

export async function getUserId(): Promise<string> {
  const cookieStore = await cookies()
  const idToken = cookieStore.get("privy-id-token")?.value
  if (!idToken) {
    // Fall back to auth token
    const token = cookieStore.get("privy-token")?.value
    if (!token) {
      throw new Error("No token found")
    }
    const claims = await privy.verifyAuthToken(token)
    return claims.userId
  } else {
    const user = await privy.getUser({ idToken: idToken })
    return user.id
  }
}

export async function getUserSolWalletAddress(
  
): Promise<string | undefined> {

  const walletAccount = await getUserWallet('solana')
  return walletAccount?.address
}

export async function getUserEvmWalletAddress(
  
): Promise<string | undefined> {

  const walletAccount = await getUserWallet('ethereum')

  return walletAccount?.address
}

export async function getUserWallet(
  chainType: 'solana' | 'ethereum'
): Promise<WalletWithMetadata | undefined> {
  const user = await getUser()
  const walletAccount = user?.linkedAccounts?.find(acc => {
    if (acc.type === 'wallet') {
      return (
        acc.chainType === chainType &&
        acc.address && acc.walletClientType === 'privy')
    }
    return false
  })

  if (walletAccount && walletAccount.type === 'wallet') {

    return walletAccount

  }
  return undefined
}
