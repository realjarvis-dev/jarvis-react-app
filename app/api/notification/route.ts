import { getNotification } from '@/lib/notification/get-notification'
import { privy } from '@/lib/privy/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const privyToken = request.cookies.get('privy-token')?.value

  if (!privyToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let userId: string
  try {
    const claims = await privy.verifyAuthToken(privyToken)
    userId = claims.userId.split(":")[2]
  } catch (error) {
    console.error('Error verifying auth token:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  try {
    const notifications = await getNotification(userId)
    console.log("notifications", notifications, userId)
    return NextResponse.json(notifications)
  } catch (error) {
    console.error('API route error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
