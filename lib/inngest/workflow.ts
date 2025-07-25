
import { Engine } from "@inngest/workflow-kit";
import { getRedisClient } from "../redis/config";
import { inngest } from "./client";               
import { actionsWithHandlers } from "./workflow-action-handlers";
import { Workflow } from "@inngest/workflow-kit";

async function loadWorkflow(event: { data: { name: string } }) {
  const redis = await getRedisClient();
  const wfData = await redis.hgetall(`workflow:${event.data.name}`);
  if (!wfData) throw new Error("Workflow not found: " + event.data.name);
  return JSON.parse(wfData.workflow as string) as Workflow;
}

const engine = new Engine({
  actions: actionsWithHandlers,
  loader: loadWorkflow,
});

export default inngest.createFunction(
  { id: "user-defined-workflow", name: "User Defined Workflow Runner" },
  { event: "workflow.trigger" },
  async ({ event, step }) => {
      await engine.run({ event, step })
  }
);
