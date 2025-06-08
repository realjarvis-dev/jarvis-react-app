import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Early return for static assets to reduce processing overhead
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const code = request.nextUrl.searchParams.get('privy_oauth_code')
  if (code) {
    // Only process OAuth when code is present
    const response = NextResponse.next()
    response.headers.set('x-privy-oauth-code', code)
    return response
  }

  // Simplified header processing for better performance
  const response = NextResponse.next()
  
  // Only add essential headers to reduce overhead
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`
  
  response.headers.set('x-base-url', baseUrl)

  // Only process auth token when present to reduce overhead
  const privyToken = request.cookies.get('privy-token')?.value
  if (privyToken) {
    response.headers.set('authorization', `Bearer ${privyToken}`)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - config/models.json (public config file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|config/models.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
