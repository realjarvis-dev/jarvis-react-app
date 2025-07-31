import Pusher from 'pusher-js'

let pusher: Pusher | null = null

// Only initialize Pusher if environment variables are provided
if (process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
  pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  })
} else {
  console.warn('Pusher configuration missing. Real-time price alerts will be disabled.')
}

export { pusher, Pusher }