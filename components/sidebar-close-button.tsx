'use client'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { X } from 'lucide-react'

export function SidebarCloseButton() {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      className="h-6 w-6 hover:bg-sidebar-accent"
    >
      <X size={16} />
      <span className="sr-only">Close sidebar</span>
    </Button>
  )
}
