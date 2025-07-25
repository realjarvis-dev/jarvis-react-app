import { getRedisClient } from "@/lib/redis/config";
import { NextResponse } from "next/server";
import { type Workflow } from "@/lib/inngest/types";


export async function GET() {
  const redis = await getRedisClient();
  const workflowIds = await redis.smembers("workflows");

  if (!workflowIds || workflowIds.length === 0) {
    return NextResponse.json({ workflows: [] });
  }

  const pipeline = redis.pipeline();
  workflowIds.forEach((id) => {
    if (id) {
      pipeline.hgetall(`workflow:${id}`);
    }
  });
  const results = (await pipeline.exec()) as Workflow[];

  const workflows = results
    .map((workflowData: any) => {
      if (!workflowData) return null;
      return {
        ...workflowData,
        enabled: String(workflowData.enabled) === "true",
        workflow:
          typeof workflowData.workflow === "string"
            ? JSON.parse(workflowData.workflow)
            : workflowData.workflow,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ workflows });
} 