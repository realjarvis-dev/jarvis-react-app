import { actions } from "./workflow-actions";
import { EngineAction } from "@inngest/workflow-kit";
import { getRedisClient, RedisWrapper } from "../redis/config";



export const actionsWithHandlers: EngineAction[] = [
    {
      ...actions[0],
      handler: async ({ event, step }) => {
        const amount = event.data.amount;
        await step.run("buy-pt", async () => {
          console.log(`🔸 buy: buy ${amount} PT`);
          const redis = await getRedisClient();
          await redis.hmset(`event:${event.data.id}`, { "ptAmount": String(amount) });
          
          return `bought-${amount}`;
        });

        return;
      },
    },
    {
      ...actions[1],
      handler: async ({ event, step }) => {

        
        await step.run("deposit-pt", async () => {
            const redis = await getRedisClient();
            const eventData = await redis.hgetall(`event:${event.data.id}`);
            const ptAmount = eventData?.ptAmount;
            console.log(`🔸 deposit: deposit ${ptAmount} PT`);
            await redis.hmset(`event:${event.data.id}`, { "depositDone": "true" });
        });
        
        return;
      },
    },
    {
      ...actions[2],
      handler: async ({ event, step }) => {

        await step.run("borrow-token", async () => {
            const redis = await getRedisClient();
            const eventData = await redis.hgetall(`event:${event.data.id}`);
            const ptAmount = eventData?.ptAmount;
            const tokenAmount = Number(ptAmount) * 0.8;
            console.log(`🔸 borrow: borrow ${tokenAmount} token`);

            await redis.hmset(`event:${event.data.id}`, { "borrowDone": "true" });

        });
        return;
      },
    },
  ];