'use client'

import { shareChat } from '@/lib/actions/chat'
import { cn } from '@/lib/utils'
import { Check, Copy, Share } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog'
import { Spinner } from './ui/spinner'

interface ChatShareProps {
  chatId: string
  className?: string
}

export function ChatShare({ chatId, className }: ChatShareProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [hasCopied, setHasCopied] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopied])

  const handleGenerateLink = async () => {
    startTransition(async () => {
      const result = await shareChat(chatId)
      if (!result?.sharePath) {
        toast.error('Failed to share chat')
        return
      }
      const url = new URL(result.sharePath, window.location.href).toString()
      setShareUrl(url)
    })
  }

  const handleCopy = () => {
    if (!shareUrl) return

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      setHasCopied(true)
      toast.success('Link copied to clipboard')
    }
  }

  const canCopy =
    isMounted && typeof navigator !== 'undefined' && !!navigator.clipboard

  // Shortened URL for display (similar to wallet address pattern)
  const shortUrl = shareUrl
    ? `${shareUrl.substring(0, 20)}...${shareUrl.substring(
        shareUrl.length - 10
      )}`
    : ''

  return (
    <div className={className}>
      <Dialog
        open={open}
        onOpenChange={open => setOpen(open)}
        aria-labelledby="share-dialog-title"
        aria-describedby="share-dialog-description"
      >
        <DialogTrigger asChild>
          <Button
            className="rounded-full"
            size="icon"
            variant="ghost"
            onClick={() => setOpen(true)}
          >
            <Share size={14} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link to Jarvis response</DialogTitle>
            <DialogDescription>
              Anyone with the link will be able to view this Jarvis response.
            </DialogDescription>
          </DialogHeader>

          {!shareUrl ? (
            <DialogFooter className="items-center">
              <Button onClick={handleGenerateLink} disabled={pending} size="sm">
                {pending ? <Spinner /> : 'Generate link'}
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-4">
              <div
                className={cn(
                  'flex items-center gap-2 p-3 border rounded-lg bg-muted/50'
                )}
              >
                <span className="text-sm break-all flex-1">{shortUrl}</span>
                <Button
                  onClick={handleCopy}
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  aria-label="Copy share link"
                  disabled={!canCopy}
                >
                  {hasCopied ? (
                    <Check className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
              <DialogFooter className="items-center">
                <Button
                  onClick={() => setOpen(false)}
                  variant="outline"
                  size="sm"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
