'use client'

import { DefaultSkeleton } from '@/components/default-skeleton'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { usePrivy } from '@privy-io/react-auth'
import { useQuery } from '@tanstack/react-query'
import { BellIcon } from 'lucide-react'
import useLocalStorage from 'use-local-storage-state'

interface Notification {
  id: string
  userId: string
  msg: string
  title: string
  createdAt: string
}

const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await fetch('/api/notification')
  if (!response.ok) {
    throw new Error('Network response was not ok')
  }
  return response.json()
}

function formatTimestamp(timestamp: string) {
  const date = new Date(parseInt(timestamp, 10))
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  let interval = seconds / 31536000
  if (interval > 1) return `${Math.floor(interval)}y ago`
  interval = seconds / 2592000
  if (interval > 1) return `${Math.floor(interval)}mo ago`
  interval = seconds / 86400
  if (interval > 1) return `${Math.floor(interval)}d ago`
  interval = seconds / 3600
  if (interval > 1) return `${Math.floor(interval)}h ago`
  interval = seconds / 60
  if (interval > 1) return `${Math.floor(interval)}m ago`
  return 'just now'
}

const NotificationInbox = () => {
  const { ready, authenticated } = usePrivy()
  const {
    data: notifications,
    isLoading,
    isError
  } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: ready && authenticated,
    initialData: []
  })

  const [lastSeenAt, setLastSeenAt] = useLocalStorage('lastSeenAt', {
    defaultValue: Date.now() - 1000 * 60 * 60 * 24
  })

  const handlePopoverChange = (open: boolean) => {
    if (!open) {
      setLastSeenAt(Date.now())
    }
  }

  if (isError) {
    return null
  }

  const unreadNotifications =
    notifications.filter(n => parseInt(n.createdAt, 10) > lastSeenAt) || []

  return (
    <Popover onOpenChange={handlePopoverChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <BellIcon className="h-5 w-5" />
          {unreadNotifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500"></span>
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Notifications</h4>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                You have {unreadNotifications.length} unread messages.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            {isLoading ? (
              <DefaultSkeleton />
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className="mb-2 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0"
                >
                  <span
                    className={cn(
                      'flex h-2 w-2 translate-y-1 rounded-full',
                      parseInt(notification.createdAt, 10) > lastSeenAt &&
                        'bg-sky-500'
                    )}
                  />
                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {notification.msg}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(notification.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default NotificationInbox
