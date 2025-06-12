import { bus } from '@/lib/pubsub/simple-pubsub'
import { NextRequest } from 'next/server'
import { getUser, getUserId } from '@/lib/privy/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    // close the stream if user is not logged in
    let userId;
    try {
        userId = await getUserId()
        if (!userId) {
            return new Response('Unauthorized', { status: 401 })
        }
    } catch (error) {
        return new Response('Unauthorized', { status: 401 })
    }
    
  const stream = new ReadableStream({
    start(controller) {
      const onUpdate = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        console.log(message)
        controller.enqueue(new TextEncoder().encode(message))
      }


      bus.on('balance-change/' + userId, onUpdate)
      
      // The requestAborted signal is fired when the client closes the connection
      request.signal.addEventListener('abort', () => {
        bus.off('balance-change/' + userId, onUpdate)
        controller.close()
      })
    }
  })
//   setInterval(() => {
//     bus.emit('balance-change/' + userId, {
//       message: 'test'
//     })
//   }, 10000)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
