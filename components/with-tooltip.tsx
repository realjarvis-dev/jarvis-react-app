import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import useIsMobile from '@/lib/hooks/use-is-mobile'
import { Info } from 'lucide-react'
import React from 'react'

interface WithTooltipProps {
  children: React.ReactNode
  tooltipText: string
}

export function WithTooltip({ children, tooltipText }: WithTooltipProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="flex items-center gap-1">
        {children}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative -top-2 flex cursor-pointer items-center border-none bg-transparent p-0 text-current"
            >
              <Info className="size-3 sm:size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            className="max-w-[150px] whitespace-normal rounded-xl border border-sky-500/50 bg-black/70 px-3 py-2 text-white shadow-lg shadow-sky-500/10 backdrop-blur-md"
          >
            <p className="text-sm">{tooltipText}</p>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative -top-2 flex cursor-pointer items-center border-none bg-transparent p-0 text-current hover:opacity-80"
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
