// lib/redisPubSub.ts
import { Redis as UpstashRedisPublisher } from '@upstash/redis'
import {Redis as UpstashRedisSubscriber} from 'ioredis'
import { createClient, RedisClientType } from 'redis'
import { redisConfig } from './config'

let pubClient: UpstashRedisPublisher | RedisClientType
let subClient: UpstashRedisSubscriber | RedisClientType

async function initClients() {
  if (pubClient && subClient) return

  if (redisConfig.useLocalRedis) {
    // Local: TCP-based redis client
    const url = redisConfig.localRedisUrl!
    pubClient = createClient({ url })
    subClient = pubClient.duplicate()
    await (pubClient as RedisClientType).connect()
    await (subClient as RedisClientType).connect()
  } else {
    // Upstash: HTTP-based redis client
    pubClient = new UpstashRedisPublisher({
      url: redisConfig.upstashRedisRestUrl!,
      token: redisConfig.upstashRedisRestToken!
    })
    // For subscribe, Upstash client supports SSE subscribe
    subClient = new UpstashRedisSubscriber(redisConfig.upstashRedisRestUrl!)
  }
}

/**
 * Publish a stringified message to a channel.
 */
export async function publish(channel: string, message: string) {
  await initClients()
  if (pubClient instanceof UpstashRedisPublisher) {
    await pubClient.publish(channel, message)
  } else {
    await (pubClient as RedisClientType).publish(channel, message)
  }
}

/**
 * Subscribe to a channel. Returns an async unsubscribe function.
 */
export async function subscribe(
  channel: string,
  onMessage: (channel: string, msg: string) => void
): Promise<() => Promise<void>> {
  await initClients()
  if (subClient instanceof UpstashRedisSubscriber) {
    subClient.on('message', (channel, message) => {
      onMessage(channel, message)
    })
    return async () => {
      subClient.quit()
    }
  } else {
    const localSub = subClient as RedisClientType
    await localSub.subscribe(channel, (message) => {
      onMessage(channel, message)
    })
    return async () => {
      await localSub.unsubscribe(channel)
    }
  }
}
