import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'
import { IconLogo } from './ui/icons'
import { Button } from './ui/button'

// Immediate console log to verify module loading
console.log('[AppSidebar] Module loaded')

export default function AppSidebar() {
  // Immediate console log to verify component function execution
  console.log('[AppSidebar] Component function called')
  
  const { toggleSidebar } = useSidebar()

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row justify-between items-center">
        <div className="flex items-center gap-2 px-2 py-3">
          <a href="/" className="size-5">
            <IconLogo className={cn('size-5')} />
          </a>
          <Link href="/" className="font-semibold text-sm">
            Jarvis
          </Link>
        </div>
        <div className="flex items-center px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-6 w-6 hover:bg-sidebar-accent"
          >
            <X size={16} />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 h-full">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/" className="flex items-center gap-2">
                <Plus className="size-4" />
                <span>New</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
