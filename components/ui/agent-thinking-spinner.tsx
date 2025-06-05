import { cn } from '@/lib/utils'

interface AgentThinkingSpinnerProps {
  className?: string
}

export const AgentThinkingSpinner = ({
  className
}: AgentThinkingSpinnerProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-4',
        className
      )}
    >
      <div className="flex items-center space-x-1">
        <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-500 [animation-delay:-0.3s]"></div>
        <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-500 [animation-delay:-0.15s]"></div>
        <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-500"></div>
      </div>
      <p className="text-sm text-zinc-500">Jarvis is thinking...</p>
    </div>
  )
}
