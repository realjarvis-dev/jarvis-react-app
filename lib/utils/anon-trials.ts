import { headers } from 'next/headers'

export async function getAnonId() {
  const headersList = await headers()
  const anonId = headersList.get('x-user-id')
  return anonId
}
