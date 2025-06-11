import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import React, { useState } from 'react'

interface WithTooltipProps {
  children: React.ReactNode
  tooltipText: string
}

export function WithTooltip({ children, tooltipText }: WithTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="flex items-center gap-1">
      {children}
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative -top-2 flex cursor-pointer items-center border-none bg-transparent p-0 text-current hover:opacity-80"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Info className="size-3 sm:size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="max-w-[150px] whitespace-normal rounded-xl border border-sky-500/50 bg-black/70 px-3 py-2 text-white shadow-lg shadow-sky-500/10 backdrop-blur-md"
        >
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
