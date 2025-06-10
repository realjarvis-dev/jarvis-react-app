import { getServerSideNetworkConfig } from '@/lib/network/gateway'
import { getUser, getUserEvmWalletAddress } from '@/lib/privy/client'
import { computeUserUsdBalance } from '@/lib/use-cases/compute-user-usd-balance'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const networkConfig = await getServerSideNetworkConfig()
    let authenticated = false
    try {
        await getUser()
        authenticated = true
    } catch (error) {
        console.log('User not logged in')
    }
    if (!authenticated) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }
    const walletAddress = await getUserEvmWalletAddress()
    if (!walletAddress) {
        return NextResponse.json({ error: 'User does not have an Ethereum wallet' }, { status: 400 })
    }
    const usdBalance = await computeUserUsdBalance(walletAddress, networkConfig.chainId, networkConfig.isDemo)
    return NextResponse.json({ usdBalance })
}