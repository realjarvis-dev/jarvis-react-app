import { actions } from "./workflow-actions";
import { EngineAction } from "@inngest/workflow-kit";
import { getRedisClient, RedisWrapper } from "../redis/config";

async function getEventData(eventId: string, redis: RedisWrapper) {
    const eventData = await redis.hgetall(`event:${eventId}`);
    if (!eventData) {
        // create an event data
        return {}
    }
    return eventData;
}

export const actionsWithHandlers: EngineAction[] = [
    {
      ...actions[0],
      handler: async ({ event, step }) => {
        const amount = event.data.amount;
        await step.run("buy-pt", async () => {
          console.log(`🔸 buy: buy ${amount} PT`);
          const redis = await getRedisClient();
          const eventData = await getEventData(event.data.id, redis);
          eventData.ptAmount = String(amount);
          await redis.hmset(`event:${event.data.id}`, eventData);
          
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
            const eventData = await getEventData(event.data.id, redis);
            const ptAmount = eventData?.ptAmount;
            console.log(`🔸 deposit: deposit ${ptAmount} PT`);
            eventData.depositDone = true;

          await redis.hmset(`event:${event.data.id}`, eventData);
        });
        
        return;
      },
    },
    {
      ...actions[2],
      handler: async ({ event, step }) => {

        await step.run("borrow-token", async () => {
            const redis = await getRedisClient();
            const eventData = await getEventData(event.data.id, redis);
            const ptAmount = eventData?.ptAmount;
            const tokenAmount = Number(ptAmount) * 0.8;
            console.log(`🔸 borrow: borrow ${tokenAmount} token`);

            eventData.borrowDone = true;
            await redis.hmset(`event:${event.data.id}`, eventData);

        });
        return;
      },
    },
  ];