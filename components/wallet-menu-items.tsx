'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import useIsMobile from '@/lib/hooks/use-is-mobile';
import { useNetwork } from '@/lib/network/context';
import {
    useFundWallet, useHeadlessDelegatedActions, usePrivy,
    useSolanaWallets,
    useWallets, type ConnectedSolanaWallet,
    type ConnectedWallet, type WalletWithMetadata
} from '@privy-io/react-auth';
import { AlertCircle, ArrowRightCircle, BarChart3, Brain, CheckCircle, Loader2, Unlink2, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
  const { activeNetwork } = useNetwork()
  const router = useRouter()
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets()
  const { delegateWallet, revokeWallets } = useHeadlessDelegatedActions();
  const [solanaWalletToDelegate, setSolanaWalletToDelegate] = useState<ConnectedSolanaWallet | undefined>(undefined);
  const [solanaWalletAlreadyDelegated, setSolanaWalletAlreadyDelegated] = useState<boolean>(false);
  
  const { wallets: evmWallets, ready: evmReady } = useWallets()
  const [evmWalletToDelegate, setEvmWalletToDelegate] = useState<ConnectedWallet | undefined>(undefined);
  const [evmWalletAlreadyDelegated, setEvmWalletAlreadyDelegated] = useState<boolean>(false);
  
  // Wallet indexing state
  const [isIndexingWallet, setIsIndexingWallet] = useState<boolean>(false);
  const [indexingStatus, setIndexingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (solanaReady) {
      // Find the embedded wallet to delegate from the array of the user's wallets
        const solanaWalletToDelegate = solanaWallets.find((wallet) => wallet.walletClientType === 'privy');
        setSolanaWalletToDelegate(solanaWalletToDelegate);
    }
  }, [solanaReady, solanaWallets])

  useEffect(() => {
    if (evmReady) {
      // console.log('isMobile', isMobile)
      const evmWalletToDelegate = evmWallets.find((wallet) => wallet.walletClientType === 'privy');
      // console.log('evmWalletToDelegate', evmWalletToDelegate)
      setEvmWalletToDelegate(evmWalletToDelegate);
    }
  }, [evmReady, evmWallets])

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
  const { fundWallet }= useFundWallet();
  const handleFundWallet = async () => {
    if (!evmReady || !evmWalletToDelegate) return;
    await fundWallet(evmWalletToDelegate.address, {chain: activeNetwork.viemChain});
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

  const handleIndexWallet = async () => {
    if (!userReady || !user) {
      toast.error('Please make sure you are logged in')
      return
    }

    if (isIndexingWallet) {
      return // Prevent multiple simultaneous requests
    }

    setIsIndexingWallet(true)
    setIndexingStatus('loading')
    
    try {
      toast.info('Starting wallet analysis...', {
        description: 'This may take a few moments to complete',
        duration: 3000
      })

      const response = await fetch('/api/wallet/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxPages: 3,
          maxConcurrency: 2,
          analysisModel: 'openai:gpt-4o-mini'
        })
      })

      const result = await response.json()

      if (result.success) {
        setIndexingStatus('success')
        
        toast.success('Wallet indexed successfully!', {
          description: `Analyzed ${result.summary.totalTransactions} transactions across ${result.summary.pagesProcessed} pages. Risk profile: ${result.summary.riskProfile}`,
          duration: 5000
        })
        
        console.log('Wallet indexing completed:', result)
      } else {
        setIndexingStatus('error')
        
        toast.error('Wallet indexing failed', {
          description: result.error || 'Unknown error occurred',
          duration: 4000
        })
        
        console.error('Wallet indexing failed:', result.error)
      }
    } catch (error) {
      setIndexingStatus('error')
      
      toast.error('Network error', {
        description: 'Failed to connect to indexing service',
        duration: 4000
      })
      
      console.error('Network error during wallet indexing:', error)
    } finally {
      setIsIndexingWallet(false)
      
      // Reset status after a delay
      setTimeout(() => {
        setIndexingStatus('idle')
      }, 3000)
    }
  }

  const getIndexingIcon = () => {
    switch (indexingStatus) {
      case 'loading':
        return <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
      default:
        return <Brain className="mr-2 h-4 w-4" />
    }
  }

  const getIndexingText = () => {
    switch (indexingStatus) {
      case 'loading':
        return isMobile ? 'Indexing...' : 'Analyzing wallet...'
      case 'success':
        return isMobile ? 'Indexed!' : 'Wallet indexed!'
      case 'error':
        return isMobile ? 'Failed' : 'Indexing failed'
      default:
        return isMobile ? 'Index wallet' : 'Index wallet'
    }
  }

  return (
    <>
      <DropdownMenuItem onClick={handleFundWallet} disabled={!evmReady || !evmWalletToDelegate}>
        <Wallet className="mr-2 h-4 w-4" />
        <span>Fund Wallet</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => router.push('/wallet/summary')}>
        <BarChart3 className="mr-2 h-4 w-4" />
        <span>View Analysis</span>
      </DropdownMenuItem>
      <DropdownMenuItem 
        onClick={handleIndexWallet} 
        disabled={!userReady || !user || isIndexingWallet}
      >
        {getIndexingIcon()}
        <span>{getIndexingText()}</span>
      </DropdownMenuItem>
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
