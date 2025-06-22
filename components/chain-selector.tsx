'use client'

import { allNetworkConfigs } from '@/lib/network/config'
import { useNetwork } from '@/lib/network/context'
import type { NetworkConfig } from '@/lib/network/types'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { UsdBalanceDisplay } from './ui/usd-balance-display'

export function ChainSelector() {
  const { selectedChain, setSelectedChain, isDemoMode } = useNetwork()
  const [open, setOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const availableChainOptions = Object.values(
    allNetworkConfigs
  ) as NetworkConfig[]

  const selectedOption = availableChainOptions.find(
    option => option.id === selectedChain
  )

  const dropdownChainOptions = isDemoMode
    ? availableChainOptions.filter(option => option.id === 'ethereum')
    : availableChainOptions.filter(option => !option.disabled)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <Button
            variant="outline"
            className={cn(
              'gap-1 px-3 border border-input text-muted-foreground bg-background',
              'hover:bg-accent hover:text-accent-foreground rounded-full',
              'min-w-[40px] sm:min-w-[100px] justify-between',
              'h-8 sm:h-10',
              'focus:shadow-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0',
              'flex items-center'
            )}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <div className="flex items-center gap-2">
              {selectedOption?.icon && (
                <span className="flex items-center">
                  <Image
                    src={selectedOption.icon}
                    width={20}
                    height={20}
                    alt={selectedOption.displayName + ' icon'}
                    className="block"
                  />
                </span>
              )}
              <span className="hidden sm:inline text-xs">
                {selectedOption?.displayName}
              </span>
              <UsdBalanceDisplay />
            </div>
            <ChevronDown className="size-3 hidden sm:inline" />
          </Button>
          {selectedOption && (
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 -top-12 z-20 sm:hidden',
                showTooltip ? 'block' : 'hidden'
              )}
            >
              <div className="px-3 py-1 rounded-lg bg-black/80 text-white text-xs shadow-lg flex items-center">
                {selectedOption.displayName}
                {selectedOption.icon && (
                  <span className="ml-2">
                    <Image
                      src={selectedOption.icon}
                      width={20}
                      height={20}
                      alt={selectedOption.displayName + ' icon'}
                      className="block"
                    />
                  </span>
                )}
              </div>
              <div className="w-3 h-3 bg-black/80 rotate-45 mx-auto -mt-1" />
            </div>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[120px]">
        {dropdownChainOptions.map(option => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => {
              if (option.disabled) return
              setSelectedChain(option.id)
              setOpen(false)
            }}
            className={cn(
              'flex items-center cursor-pointer',
              selectedChain === option.id && 'bg-accent',
              option.disabled && 'opacity-50 cursor-not-allowed'
            )}
            disabled={option.disabled}
          >
            {option.icon && (
              <span className="mr-2 flex items-center">
                <Image
                  src={option.icon}
                  width={20}
                  height={20}
                  alt={option.displayName + ' icon'}
                  className="block"
                />
              </span>
            )}
            <span className="text-sm">{option.displayName}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
