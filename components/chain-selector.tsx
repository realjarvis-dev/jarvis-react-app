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

export type ChainType = 'ethereum' | 'berachain'

interface ChainOption {
  id: ChainType
  name: string
  disabled?: boolean
}

const chainOptions: ChainOption[] = [
  {
    id: 'ethereum',
    name: 'Ethereum'
  },
  {
    id: 'berachain',
    name: 'Berachain'
  }
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

  const selectedOption = chainOptions.find(option => option.id === selectedChain)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'gap-1 px-3 border border-input text-muted-foreground bg-background',
            'hover:bg-accent hover:text-accent-foreground rounded-full',
            'min-w-[100px] justify-between'
          )}
        >
          <span className="text-xs">{selectedOption?.name}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[120px]">
        {chainOptions
          .filter(option => {
            // In demo mode, only show Ethereum
            if (isDemoMode) {
              return option.id === 'ethereum'
            }
            // In normal mode, show all networks
            return true
          })
          .map((option) => {
            return (
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
                <span className="text-sm">{option.name}</span>
              </DropdownMenuItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 