import { actions } from "./workflow-actions";
import { EngineAction } from "@inngest/workflow-kit";
import { getRedisClient, RedisWrapper } from "../redis/config";
import { executePendleSwap, getPendleSwapTokensData } from "../pendle/swap";
import { parseUnits, formatUnits } from "viem";
import { erc20Approval, executeTransaction } from "../privy/utils";
import { ethers } from "ethers";
const PT_ADDRESS = "0xc347584b415715b1b66774b2899fef2fd3b56d6e"
const MARKET_ADDRESS = "0xff43e751f2f07bbf84da1fc1fa12ce116bf447e5"

// const MARKET_ADDRESS = "0xda57abf95a7c21eb9df08fbaada182f749f6c62f"
// const PT_ADDRESS = "0xfc66d247f577bfc87df8a5267c43676c4a088b8b"

const PT_DECIMALS = 18
const MARKET_DECIMALS = 18
const USDC_DECIMALS = 6
const DAI_DECIMALS = 18
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const DAI_ADDRESS = "0x6b175474e89094c44da98b954eedeac495271d0f"
const walletId = "u6g0wul9ios8ga92x4qqojqg"


export const actionsWithHandlers: EngineAction[] = [
    {
      ...actions[0],
      handler: async ({ event, step, workflow, workflowAction, state }) => {
        const currState = workflowAction.id
        let amount
        if (currState === "1") {
          amount = event.data.amount
        } else {
          const prevState = String(Number(currState) - 1)
          amount = (state.get(prevState)?.amount)
        }
        const amountInWei = parseUnits(String(amount), USDC_DECIMALS)

        const amountOut = await step.run("buy-pt", async () => {
          console.log("input amount: ", amount)
          const quote = await getPendleSwapTokensData(
            MARKET_ADDRESS,
            USDC_ADDRESS,
            PT_ADDRESS,
            amountInWei.toString(),
            0.1, // 10% slippage for demo mode
            true,
            1,
            event.data.userWalletAddress
          )
          console.log(
            "got quote data"
          )
          const tx = await erc20Approval(
            USDC_ADDRESS,
            quote.tx.to,
            amountInWei.toString(),
            event.data.userWalletAddress,
            1,
            true,
            60000,
            event.data.evmWalletId,
            event.data.userWalletAddress
          )
          console.log("Approve erc 20")
          const txData = {
            to: quote.tx.to,
            from: event.data.userWalletAddress,
            data: quote.tx.data,
            value: quote.tx.value || '0'
          }
          
          const txResponse = await executeTransaction(
            txData,
            1,
            { estimateGas: false, gasLimit: ethers.toQuantity(1000000) as `0x${string}` },
            true,
            60000,
            event.data.evmWalletId,
            event.data.userWalletAddress
          )
          console.log(`🔸 buy: buy ${quote.data.amountOut} PT`);
          const redis = await getRedisClient();
          await redis.hmset(`event:${event.data.id}`, { [`ptAmount-${currState}`]: String(quote.data.amountOut),
            [`txHash-${currState}`]: txResponse.hash
          });
          
          return formatUnits(BigInt(quote.data.amountOut), PT_DECIMALS);
        });

        return { amount: amountOut };
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
            await redis.hmset(`event:${event.data.id}`, { [`depositDone-${currState}`]: "true" });
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
        return { amount: tokenAmount };
      },
    },
  ];