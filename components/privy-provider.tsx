'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { useTheme } from 'next-themes'
import {mainnet} from 'viem/chains';

import {addRpcUrlOverrideToChain} from '@privy-io/chains';



export default function WrappedPrivyProvider({ children }: { children: React.ReactNode }) {
  const mainnetOverride = addRpcUrlOverrideToChain(mainnet, "http://127.0.0.1:8545");
  const { theme } = useTheme()
  return <PrivyProvider 
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{
  // "supportedChains": [mainnetOverride],
  "appearance": {
    "accentColor": "#6A6FF5",
    "theme": theme === "Dark" ? "dark" : "light",
    "showWalletLoginFirst": false,
    "logo": "https://auth.privy.io/logos/privy-logo.png",
    "walletChainType": "ethereum-and-solana",
    "walletList": [
      "detected_ethereum_wallets",
      "metamask",
      "coinbase_wallet",
      "rainbow",
      "wallet_connect"
    ]
  },
  "loginMethods": [
    "email",
    "google",
    "wallet"
  ],
  "fundingMethodConfig": {
    "moonpay": {
      "useSandbox": true
    }
  },
  "embeddedWallets": {
    "requireUserPasswordOnCreate": false,
    "showWalletUIs": true,
    "ethereum": {
      "createOnLogin": "all-users"
    },
    "solana": {
      "createOnLogin": "all-users"
    }
  },
  "mfa": {
    "noPromptOnMfaRequired": false
  }
}}
>
  {children}
</PrivyProvider>

}
