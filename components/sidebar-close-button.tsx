'use client'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { X } from 'lucide-react'
import useIsMobile from '@/lib/hooks/use-is-mobile'

export function SidebarCloseButton() {
  const { toggleSidebar } = useSidebar()
  const isMobile = useIsMobile()

  console.log('SidebarCloseButton render - isMobile:', isMobile)
  console.log('SidebarCloseButton render - toggleSidebar:', toggleSidebar)

  if (isMobile) {
    console.log('SidebarCloseButton: hiding on mobile')
    return null
  }

  const handleClick = () => {
    console.log('SidebarCloseButton: clicked, calling toggleSidebar')
    toggleSidebar()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="h-6 w-6 hover:bg-sidebar-accent"
    >
      <X size={16} />
      <span className="sr-only">Close sidebar</span>
    </Button>
  )
}
