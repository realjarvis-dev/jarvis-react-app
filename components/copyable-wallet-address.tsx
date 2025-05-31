'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CopyableWalletAddressProps {
  walletAddress: string
  className?: string
  walletAddressIntroText?: string
  walletAddressNotAvailableText?: string
}

export function CopyableWalletAddress({
  walletAddress,
  className,
  walletAddressIntroText,
  walletAddressNotAvailableText
}: CopyableWalletAddressProps) {
  const [hasCopied, setHasCopied] = useState(false)

  const onCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(walletAddress)
      setHasCopied(true)
    }
  }

  useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopied])

  if (!walletAddress) {
    return (
      <div
        className={cn(
          'flex items-center gap-0.5 sm:gap-1 md:gap-2 text-xs sm:text-xs md:text-sm text-muted-foreground flex-wrap sm:flex-nowrap justify-center min-h-[20px] px-0 sm:px-1 md:px-2 w-full',
          className
        )}
      >
        <span className="text-center break-all sm:break-normal sm:whitespace-nowrap max-w-[280px] sm:max-w-none">
          {walletAddressNotAvailableText || 'Wallet address not available.'}
        </span>
      </div>
    )
  }

  const shortAddress = `${walletAddress.substring(
    0,
    6
  )}...${walletAddress.substring(walletAddress.length - 4)}`

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 sm:gap-1 md:gap-2 text-xs sm:text-xs md:text-sm text-muted-foreground flex-wrap sm:flex-nowrap justify-center min-h-[20px] px-0 sm:px-1 md:px-2 w-full',
        className
      )}
    >
      <span className="text-center break-all sm:break-normal sm:whitespace-nowrap max-w-[240px] sm:max-w-none">
        {walletAddressIntroText || 'Your wallet address:'} {shortAddress}
      </span>
      <Button
        onClick={onCopy}
        variant="ghost"
        size="icon"
        className="size-5 sm:size-6 shrink-0"
        aria-label="Copy wallet address"
        disabled={typeof navigator === 'undefined' || !navigator.clipboard}
      >
        {hasCopied ? (
          <Check className="size-2 sm:size-3 text-green-500" />
        ) : (
          <Copy className="size-2 sm:size-3" />
        )}
      </Button>
    </div>
  )
}
