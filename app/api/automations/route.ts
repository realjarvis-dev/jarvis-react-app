import { type Workflow } from '@/lib/inngest/types'
import { getRedisClient } from '@/lib/redis/config'
import { NextResponse } from 'next/server'

export async function POST() {
  const redis = await getRedisClient()
  const id = crypto.randomUUID()

  // 1) Build your Workflow object in TS-land
  const newWorkflow: Workflow = {
    id,
    name: 'New Automation',
    description: 'A new automation workflow',
    trigger: 'strategy.start',
    enabled: false,
    createdAt: new Date().toISOString(),
    workflow: null  // default empty workflow
  }

  // 2) Prepare a flat record of strings for Redis
  const record: Record<string, string> = {
    id:            newWorkflow.id,
    name:          newWorkflow.name,
    description:   newWorkflow.description ?? '',
    trigger:       newWorkflow.trigger,
    enabled:       String(newWorkflow.enabled),
    createdAt:     newWorkflow.createdAt,
    workflow:      JSON.stringify(newWorkflow.workflow),
  }

  // 3) Store in Redis
  //    - Add the workflow ID to a set for easy listing
  //    - Use hSet to write the hash in one call
  await redis.sadd('workflows', id)
  await redis.hmset(`workflow:${id}`, record)

  return NextResponse.json({ id })
}
