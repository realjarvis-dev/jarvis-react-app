'use client'

import { InspectorDrawer } from '@/components/inspector/inspector-drawer'
import { InspectorPanel } from '@/components/inspector/inspector-panel'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { useSidebar } from '@/components/ui/sidebar'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { cn } from '@/lib/utils'
import React, { useEffect, useState } from 'react'
import { useArtifact } from './artifact-context'

export function ChatArtifactContainer({
  children
}: {
  children: React.ReactNode
}) {
  const { state } = useArtifact()
  const isMobile = useMediaQuery('(max-width: 767px)') // Below md breakpoint
  const [renderPanel, setRenderPanel] = useState(state.isOpen)
  const { open, openMobile, isMobile: isMobileSidebar } = useSidebar()

  useEffect(() => {
    if (state.isOpen) {
      setRenderPanel(true)
    } else {
      // Optional: Delay hiding to allow for exit animations if any
      // setTimeout(() => setRenderPanel(false), 300);
      setRenderPanel(false)
    }
  }, [state.isOpen])

  if (isMobile) {
    return (
      <div className="relative flex flex-col w-full h-full min-h-0">
        <div className="flex flex-1 flex-col w-full min-h-0">
          {children}
        </div>

        <InspectorDrawer />
      </div>
    )
  }

  return (
    <div className="relative flex-1 min-h-0 h-full flex">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex flex-1 min-w-0 h-full"
      >
        <ResizablePanel
          className={cn(
            'min-w-0 h-full flex flex-col', // Ensure it's a flex column and takes full height
            state.isOpen && 'transition-[flex-basis] duration-200 ease-out'
          )}
        >
          {children} {/* Chat component will be a child here */}
        </ResizablePanel>

        {renderPanel && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              className={cn(
                'overflow-hidden h-full', // Ensure h-full
                { 'animate-slide-in-right': state.isOpen }
              )}
              maxSize={50}
              minSize={30}
              defaultSize={40} // Ensure this is a number
            >
              <InspectorPanel />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
