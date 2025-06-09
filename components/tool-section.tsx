'use client'

interface ToolSectionProps {
  tool: any
  children?: React.ReactNode
}

export function ToolSection({ tool, children }: ToolSectionProps) {
  return (
    <div className="rounded-lg border p-4 bg-muted/50">
      <div className="text-sm font-medium mb-2">
        Tool: {tool?.toolName || 'Unknown'}
      </div>
      {children}
    </div>
  )
}