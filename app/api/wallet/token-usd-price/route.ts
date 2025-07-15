import { getServerSideNetworkConfig } from '@/lib/network/gateway'
import { getUser, getUserEvmWalletAddress, getUserSolWalletAddress } from '@/lib/privy/client'
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
    const solanaWalletAddress = await getUserSolWalletAddress()
    if (!walletAddress || !solanaWalletAddress) {
        return NextResponse.json({ error: 'User does not have an Ethereum wallet' }, { status: 400 })
    }
    let usdBalance = 0
    try {
        if (networkConfig.id === 'solana') {
            usdBalance = await computeUserUsdBalance(solanaWalletAddress, networkConfig.chainId, networkConfig.isDemo)
        } else {
            usdBalance = await computeUserUsdBalance(walletAddress, networkConfig.chainId, networkConfig.isDemo)
        }
    } catch (error) {
        console.error('Error computing USD balance:', error)
        // Return 0 balance instead of failing completely
        usdBalance = 0
    }
    return NextResponse.json({ usdBalance })
}