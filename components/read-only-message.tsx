'use client'

import { Avatar } from '@/components/ui/avatar'
import { Message } from 'ai'
import { UserIcon } from 'lucide-react'

interface ReadOnlyMessageProps {
  message: Message
}

export function ReadOnlyMessage({ message }: ReadOnlyMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex items-start gap-4 py-2">
        <Avatar className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
          <UserIcon className="h-5 w-5" />
        </Avatar>
        <div className="flex-1 space-y-2 overflow-hidden px-1">
          <div className="prose prose-neutral dark:prose-invert break-words">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4 py-2">
      <Avatar className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          className="h-5 w-5"
          fill="currentColor"
        >
          <path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0c-27.39 8.95-50.86 27.83-66.09 54.16a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8ZM72 96a56 56 0 1 1 56 56 56.06 56.06 0 0 1-56-56Z" />
        </svg>
      </Avatar>
      <div className="flex-1 space-y-2 overflow-hidden px-1">
        <div className="prose prose-neutral dark:prose-invert whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  )
} 