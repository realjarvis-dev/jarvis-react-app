
import { Engine } from "@inngest/workflow-kit";
import { getRedisClient } from "../redis/config";
import { inngest } from "./client";               // 你的 Inngest SDK 实例
import { actionsWithHandlers } from "./workflow-action-handlers";
import { Workflow } from "@inngest/workflow-kit";

async function loadWorkflow(event: { name: string }) {
  const redis = await getRedisClient();
  const wfData = await redis.hgetall(`wf:${event.name}`);
  if (!wfData) throw new Error("Workflow not found: " + event.name);
  return wfData as unknown as Workflow;
}

const engine = new Engine({
  actions: actionsWithHandlers,
  loader: loadWorkflow,
});

export default inngest.createFunction(
  { id: "user-defined-workflow", name: "User Defined Workflow Runner" },
  { event: "workflow.trigger" },
  async ({ event, step }) => {
    // 把 engine.run 放在一个 step 里，以便于 trace
    await step.run("run-workflow-engine", async () => {
      await engine.run({ event, step });
    });
  }
);
