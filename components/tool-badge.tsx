import { DollarSign, Link, Search, Film } from 'lucide-react'
import React from 'react'
import { Badge } from './ui/badge'

type ToolBadgeProps = {
  tool: string
  children: React.ReactNode
  className?: string
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  tool,
  children,
  className
}) => {
  const icon: Record<string, React.ReactNode> = {
    search: <Search size={14} />,
    retrieve: <Link size={14} />,
    video_search: <Film size={14} />,
    pendle_opportunities: <DollarSign size={14} />,
    transfer: <DollarSign size={14} />
  }

  return (
    <Badge className={className} variant={'secondary'}>
      {icon[tool]}
      <span className="ml-1">{children}</span>
    </Badge>
  )
}
