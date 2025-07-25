'use client'
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EditIcon, PlusCircleIcon } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'

import { type Workflow } from '@/lib/inngest/types'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { toggleWorkflow } from '@/lib/inngest/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetcher = (...args: [any]) =>
  fetch(...args).then(res => res.json())

export const AutomationList = () => {
  const { data } = useSWR<{ workflows: Workflow[] }>(
    '/api/workflows',
    fetcher,
    { refreshInterval: 500000 }
  )
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleNewAutomation = async () => {
    setIsCreating(true)
    const res = await fetch('/api/automations', {
      method: 'POST'
    })
    const { id } = await res.json()
    router.push(`/automation/${id}`)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl text-center font-bold">Automations</h2>

      </div>
              <Button onClick={handleNewAutomation} disabled={isCreating}>
          <PlusCircleIcon className="mr-2 h-4 w-4" />
          New Automation
        </Button>
      <div className="grid gap-6">
        {(data?.workflows || []).map(workflow => {
          const actions: any[] = (workflow.workflow as any)?.actions || []
          return (
            <Card key={workflow.id}>
              <CardHeader>
                <CardTitle>{workflow.name}</CardTitle>
                <CardDescription>{workflow.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  {actions.length
                    ? actions.map(({ name, kind }) => name || kind).join(', ')
                    : 'No actions'}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="airplane-mode"
                    checked={workflow.enabled!}
                    onCheckedChange={() =>
                      toggleWorkflow(workflow.id, !workflow.enabled)
                    }
                  />
                  <Label htmlFor="airplane-mode">Active</Label>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/automation/${workflow.id}`}>
                    <EditIcon className="mr-2 h-4 w-4" /> Configure
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
