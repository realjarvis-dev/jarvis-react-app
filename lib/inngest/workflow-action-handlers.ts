import { actions } from "./workflow-actions";
import { EngineAction } from "@inngest/workflow-kit";
import { getRedisClient, RedisWrapper } from "../redis/config";



export const actionsWithHandlers: EngineAction[] = [
    {
      ...actions[0],
      handler: async ({ event, step, workflow, workflowAction, state }) => {
        await step.run("test", async () => {
          console.log("workflow", workflow)
          console.log("workflowAction", workflowAction)
          console.log("state", state)
        })
        const amount = event.data.amount * (1 - 0.0004)
        await step.run("buy-pt", async () => {
          console.log(`🔸 buy: buy ${amount} PT`);
          const redis = await getRedisClient();
          await redis.hmset(`event:${event.data.id}`, { "ptAmount": String(amount) });
          
          return amount;
        });

        return { amount };
      },
    },
    {
      ...actions[1],
      handler: async ({ event, step, workflow, workflowAction, state }) => {
        await step.run("test", async () => {
          console.log("workflow", workflow)
          console.log("workflowAction", workflowAction)
          console.log("state", state)
        })
        const currState = workflowAction.id
        const prevState = String(Number(currState) - 1)
        const depositAmount = state.get(prevState)?.amount
        console.log("depositAmount", depositAmount)
        await step.run("deposit-pt", async () => {
            const redis = await getRedisClient();
            // const eventData = await redis.hgetall(`event:${event.data.id}`);
            // const ptAmount = eventData?.ptAmount;
            const ptAmount = depositAmount
            console.log(`🔸 deposit: deposit ${ptAmount} PT`);
            await redis.hmset(`event:${event.data.id}`, { "depositDone": "true" });
        });
        
        return { amount: depositAmount };
      },
    },
    {
      ...actions[2],
      handler: async ({ event, step, workflow, workflowAction, state }) => {
        await step.run("test", async () => {
          console.log("workflow", workflow)
          console.log("workflowAction", workflowAction)
          console.log("state", state)
        })
        const currState = workflowAction.id
        const prevState = String(Number(currState) - 1)
        const tokenAmount = state.get(prevState)?.amount * 0.8
        console.log("borrow tokenAmount", tokenAmount)
        await step.run("borrow-token", async () => {
            const redis = await getRedisClient();
            // const eventData = await redis.hgetall(`event:${event.data.id}`);
            // const ptAmount = eventData?.ptAmount;
            // const tokenAmount = Number(ptAmount) * 0.8;
            console.log(`🔸 borrow: borrow ${tokenAmount} token`);

            await redis.hmset(`event:${event.data.id}`, { "borrowDone": "true" });

        });
        return;
      },
    },
  ];