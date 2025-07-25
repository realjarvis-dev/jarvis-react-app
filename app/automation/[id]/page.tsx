import { AutomationEditor } from '@/components/automation-editor'
import { type Workflow } from '@/lib/inngest/types'
import { getRedisClient } from '@/lib/redis/config'
import { notFound } from 'next/navigation'


export default async function Automation({
  params
}: {
  params: { id: Promise<string> }
}) {
  const redis = await getRedisClient()
  const { id } = await params
  const workflowData = await redis.hgetall(`workflow:${id!}`)

  if (workflowData && Object.keys(workflowData).length > 0) {
    const workflow: Workflow = {
      id: workflowData.id as string,
      createdAt: workflowData.createdAt as string,
      name: workflowData.name as string,
      description: workflowData.description as string,
      trigger: workflowData.trigger as string,
      enabled: String(workflowData.enabled) === 'true',
      workflow:
        typeof workflowData.workflow === 'string'
          ? JSON.parse(workflowData.workflow)
          : workflowData.workflow
    }
    return <AutomationEditor workflow={workflow} />
  } else {
    notFound()
  }
}
