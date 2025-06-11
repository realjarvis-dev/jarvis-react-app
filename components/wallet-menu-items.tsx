'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ArrowRightCircle, Unlink2, Wallet } from 'lucide-react'
import {
    usePrivy,
    useSolanaWallets,
    useWallets,
    useDelegatedActions,
    useHeadlessDelegatedActions,
    type WalletWithMetadata,
    type ConnectedSolanaWallet,
    type ConnectedWallet,
    } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useIsMobile from '@/lib/hooks/use-is-mobile';

const desktopEvmText = 'Delegate EVM wallet'
const desktopSolText = 'Delegate Sol wallet'
const desktopRevokeText = 'Revoke delegation'
const desktopEvmAlreadyDelegatedText = 'EVM wallet already delegated'
const desktopSolAlreadyDelegatedText = 'Sol wallet already delegated'
const desktopNoDelegationsText = 'No delegations to revoke'

const mobileEvmText = 'Delegate EVM wallet'
const mobileSolText = 'Delegate Sol wallet'
const mobileRevokeText = 'Revoke'
const mobileEvmAlreadyDelegatedText = 'EVM delegated'
const mobileSolAlreadyDelegatedText = 'Sol delegated'
const mobileNoDelegationsText = 'No delegations'

export function WalletMenuItems() {
  const { user, ready: userReady } = usePrivy()
  const isMobile = useIsMobile()
  
  const router = useRouter()
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets()
  const { delegateWallet, revokeWallets } = useHeadlessDelegatedActions();
  const [solanaWalletToDelegate, setSolanaWalletToDelegate] = useState<ConnectedSolanaWallet | undefined>(undefined);
  const [solanaWalletAlreadyDelegated, setSolanaWalletAlreadyDelegated] = useState<boolean>(false);
  
  const { wallets: evmWallets, ready: evmReady } = useWallets()
  const [evmWalletToDelegate, setEvmWalletToDelegate] = useState<ConnectedWallet | undefined>(undefined);
  const [evmWalletAlreadyDelegated, setEvmWalletAlreadyDelegated] = useState<boolean>(false);

  useEffect(() => {
    if (solanaReady) {
      // Find the embedded wallet to delegate from the array of the user's wallets
        const solanaWalletToDelegate = solanaWallets.find((wallet) => wallet.walletClientType === 'privy');
        setSolanaWalletToDelegate(solanaWalletToDelegate);
    }
  }, [solanaReady])

  useEffect(() => {
    if (evmReady) {
      // console.log('isMobile', isMobile)
      const evmWalletToDelegate = evmWallets.find((wallet) => wallet.walletClientType === 'privy');
      // console.log('evmWalletToDelegate', evmWalletToDelegate)
      setEvmWalletToDelegate(evmWalletToDelegate);
    }
  }, [evmReady])

  useEffect(() => {
    if (!userReady) return;
    // console.log('user in wallet menu items', user)
    if (user) { 
      const isAlreadyDelegated = !!user.linkedAccounts.find(
          (account): account is WalletWithMetadata => account.type === 'wallet' && account.delegated && account.chainType === 'solana',
      );
      setSolanaWalletAlreadyDelegated(isAlreadyDelegated);
      const isAlreadyDelegatedEvm = !!user.linkedAccounts.find(
        (account): account is WalletWithMetadata => account.type === 'wallet' && account.delegated && account.chainType === 'ethereum',
      );
      setEvmWalletAlreadyDelegated(isAlreadyDelegatedEvm);
    }
  }, [user, userReady])

  const handleWalletDetails = () => {
    console.log('Wallet details')
    router.push('/wallet')
  }

  const handleDelegateEVMWallet = async () => {
    if (!evmWalletToDelegate || !evmReady || !userReady) return;
    console.log('Delegate EVM wallet')
    await delegateWallet({address: evmWalletToDelegate.address, chainType: 'ethereum'});
  }

  const handleDelegateSolWallet = async () => {
    console.log('Delegate Sol wallet')
    if (!solanaWalletToDelegate || !solanaReady || !userReady) return; // Button is disabled to prevent this case
    await delegateWallet({address: solanaWalletToDelegate.address, chainType: 'solana'}); // or chainType: 'ethereum'
  }

  const handleRevokeAllDelegations = async () => {
    console.log('Revoke all delegations')
    if (!userReady) return;
    console.log('Revoking all delegations')
    await revokeWallets();
  }

  return (
    <>
      <DropdownMenuItem onClick={handleDelegateEVMWallet} disabled={evmWalletAlreadyDelegated || !evmReady || !userReady}>
        <ArrowRightCircle className="mr-2 h-4 w-4" />
        <span>{(isMobile ? (evmWalletAlreadyDelegated ? mobileEvmAlreadyDelegatedText : mobileEvmText) : (evmWalletAlreadyDelegated ? desktopEvmAlreadyDelegatedText : desktopEvmText))}</span>
      </DropdownMenuItem>
      {/* <DropdownMenuItem onClick={handleDelegateSolWallet} disabled={solanaWalletAlreadyDelegated || !solanaReady || !userReady}>
        <ArrowRightCircle className="mr-2 h-4 w-4" />
        <span>{(isMobile ? (solanaWalletAlreadyDelegated ? mobileSolAlreadyDelegatedText : mobileSolText) : (solanaWalletAlreadyDelegated ? desktopSolAlreadyDelegatedText : desktopSolText))}</span>
      </DropdownMenuItem> */}
      <DropdownMenuItem onClick={handleRevokeAllDelegations} disabled={!(solanaWalletAlreadyDelegated || evmWalletAlreadyDelegated) || !solanaReady || !userReady}>
        <Unlink2 className="mr-2 h-4 w-4" />
        <span>{(isMobile ? (solanaWalletAlreadyDelegated || evmWalletAlreadyDelegated ? mobileRevokeText : mobileNoDelegationsText) : (solanaWalletAlreadyDelegated || evmWalletAlreadyDelegated ? desktopRevokeText : desktopNoDelegationsText))}</span>
      </DropdownMenuItem>
    </>
  )
}
