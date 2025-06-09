import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'
import { IconLogo } from './ui/icons'

export default async function AppSidebar() {

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="relative">
        {/* Sidebar Trigger: Fixed to top-left */}
        <div
          className="absolute left-4 top-4 z-50"
          data-sidebar="trigger-wrapper"
        >
          <SidebarTrigger />
        </div>
        {/* Brand Block: Centered in the header */}
        <div className="flex items-center justify-center w-full py-3">
          <a href="/" className="size-5">
            <IconLogo className={cn('size-5')} />
          </a>
          <Link href="/" className="font-semibold text-sm ml-2">
            Jarvis
          </Link>
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
