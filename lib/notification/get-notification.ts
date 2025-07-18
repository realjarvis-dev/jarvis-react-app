import { getRedisClient } from '../redis/config'

export const getNotification = async (userId: string) => {
  const redis = await getRedisClient()
  const ids = await redis.zrange(`notification:${userId}`, 0, -1)
  console.log("ids", ids)
  if (!ids) {
    return []
  }

  const pipe = redis.pipeline()
  ids.reverse()
  ids.forEach(id => {
    const hashKey = `notification:${id}`
    pipe.hgetall(hashKey)
  })
  const rawResults = await pipe.exec()
  redis.close()
  return ids.map((id, idx) => {
    const data = Array.isArray(rawResults[idx])
      ? rawResults[idx][1]
      : rawResults[idx]
        return { id, ...data as Record<string, any> }
    })
}

