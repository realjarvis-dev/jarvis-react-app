'use client'

import { usePrivy } from '@privy-io/react-auth'
import { ToolInvocation } from 'ai'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { priceAlertUrl } from '@/lib/pubsub/eth-price-alert'

interface EthAlertSubscriptionProps {
  toolInvocation: ToolInvocation
  onConfirm: (toolCallId: string, approved: boolean, result?: any) => void
  isCompleted?: boolean
}

export function EthAlertSubscription({
  toolInvocation,
  onConfirm,
  isCompleted = false
}: EthAlertSubscriptionProps) {
  const { priceThreshold, priceType } = toolInvocation.args
  const resultData =
    toolInvocation.state === 'result' && toolInvocation.result
      ? toolInvocation.result
      : null

  const { user } = usePrivy()
  const [completed, setCompleted] = useState(isCompleted)

  const handleConfirm = async () => {
    if (!user?.id) {
      const errorMsg = 'User not authenticated.'
      toast.error(errorMsg)
      onConfirm(toolInvocation.toolCallId, false, { error: errorMsg })
      return
    }

    const userId = user.id.split(':').at(-1)
    if (!userId) {
      const errorMsg = 'Invalid user ID.'
      toast.error(errorMsg)
      onConfirm(toolInvocation.toolCallId, false, { error: errorMsg })
      return
    }

    try {
      const response = await fetch(priceAlertUrl + '/price-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          threshold: priceThreshold,
          direction: priceType
        })
      })

      if (!response.ok) {
        throw new Error('Failed to set price alert')
      }

      const result = {
        success: true,
        message: `Subscription set for price ${priceType} $${priceThreshold}`
      }
      toast.success(result.message)
      onConfirm(toolInvocation.toolCallId, true, result)
      setCompleted(true)
    } catch (error) {
      const errorMsg = 'Failed to set price alert.'
      toast.error(errorMsg)
      onConfirm(toolInvocation.toolCallId, false, { error: errorMsg })
    }
  }

  const handleDecline = () => {
    const result = {
      declined: true,
      message: 'User declined price alert.'
    }
    toast.info(result.message)
    onConfirm(toolInvocation.toolCallId, false, result)
    setCompleted(true)
  }

  if (completed || toolInvocation.state === 'result') {
    const resultDeclined = resultData?.declined

    return (
      <Card className="p-3 md:p-4 w-full flex flex-col justify-between items-center gap-2">
        <CardTitle className="text-base font-medium text-muted-foreground w-full">
          ETH Price Alert
        </CardTitle>
        <div className="flex items-center justify-start gap-1 w-full">
          {resultDeclined ? (
            <X size={16} className="text-red-500 w-4 h-4" />
          ) : (
            <Check size={16} className="text-green-500 w-4 h-4" />
          )}
          <h5 className="text-muted-foreground text-xs truncate">
            {resultDeclined
              ? 'Alert declined'
              : `Alert set for price ${priceType} $${priceThreshold}`}
          </h5>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Confirm ETH Price Alert</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          Do you want to receive an alert when the ETH price goes{' '}
          <strong>
            {priceType} ${priceThreshold}
          </strong>
          ?
        </p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleDecline}>
            Decline
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </div>
      </CardContent>
    </Card>
  )
}
