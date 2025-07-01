'use client'

import { shareChat } from '@/lib/actions/chat'
import { Share } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'
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
  const { copyToClipboard } = useCopyToClipboard({ timeout: 1000 })

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

  const handleShareAndCopy = async () => {
      // 1. Trigger shareChat and get the URL (you can still await this)
  const result = await shareChat(chatId)
  if (!result?.sharePath) {
    toast.error('Failed to share chat')
    return
  }
  const url = new URL(result.sharePath, window.location.href).toString()

  // 2. Copy immediately on tap, while gesture is still active
  try {
    copyToClipboard(url.toString())
    setHasCopied(true)
    toast.success('Link copied to clipboard')
  } catch {
    toast.error('Could not copy link to clipboard')
    return
  }

  // 3. Close the dialog (still part of same handler)
  setOpen(false)
  }

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
          <DialogFooter className="items-center">
            <Button onClick={handleShareAndCopy} disabled={pending} size="sm">
              {pending ? <Spinner /> : 'Copy link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
