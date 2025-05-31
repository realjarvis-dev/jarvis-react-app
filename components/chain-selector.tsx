'use client'

import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'


// Example SVG icons for chains
const ChainIcons: Record<string, string> = {
  ethereum: '/icons/chains/ethereum-eth.svg',
  berachain: '/icons/chains/berachain.svg',
}


export type ChainType = 'ethereum' | 'berachain'

interface ChainOption {
  id: ChainType
  name: string
  disabled?: boolean
}

const chainOptions: ChainOption[] = [

  { id: 'ethereum', name: 'Ethereum' },
  { id: 'berachain', name: 'Berachain' }

]

interface ChainSelectorProps {
  selectedChain: ChainType
  onChainChange: (chain: ChainType) => void
  isDemoMode: boolean
}

export function ChainSelector({
  selectedChain,
  onChainChange,
  isDemoMode
}: ChainSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const selectedOption = chainOptions.find(option => option.id === selectedChain)

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
            {/* Chain icon always visible */}
            <span className="flex items-center">
              <img
                src={ChainIcons[selectedChain]}
                width={20}
                height={20}
                alt={selectedOption?.name + " icon"}
                className="block"
              />
            </span>
            {/* Chain name: hidden on mobile, shown on sm+ */}
            <span className="hidden sm:inline text-xs ml-2">{selectedOption?.name}</span>
            <ChevronDown className="size-3 hidden sm:inline" />
          </Button>
          {/* Tooltip: only on mobile (sm:hidden), shown on hover/focus */}
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 -top-12 z-20 sm:hidden',
              showTooltip ? 'block' : 'hidden'
            )}
          >
            <div className="px-3 py-1 rounded-lg bg-black/80 text-white text-xs shadow-lg flex items-center">
              {selectedOption?.name}
              <span className="ml-2">
                <img
                  src={ChainIcons[selectedChain]}
                  width={20}
                  height={20}
                  alt={selectedOption?.name + " icon"}
                  className="block"
                />
              </span>
            </div>
            <div className="w-3 h-3 bg-black/80 rotate-45 mx-auto -mt-1" />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[120px]">
        {chainOptions
          .filter(option => (isDemoMode ? option.id === 'ethereum' : true))
          .map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => {
                onChainChange(option.id)
                setOpen(false)
              }}
              className={cn(
                'flex items-center cursor-pointer',
                selectedChain === option.id && 'bg-accent'
              )}
            >
              <span className="mr-2 flex items-center">
                <img
                  src={ChainIcons[option.id]}
                  width={20}
                  height={20}
                  alt={option.name + " icon"}
                  className="block"
                />
              </span>
              <span className="text-sm">{option.name}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}