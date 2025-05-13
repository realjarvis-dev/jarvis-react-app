import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('privy_oauth_code')
  if (code) {
    console.log('Middleware saw OAuth code:', code)
    // Create a new response with the modified headers
    const response = NextResponse.next()
    response.headers.set('x-privy-oauth-code', code)
    return response
  }
  // Create a response
  const response = NextResponse.next()

  // Get the protocol from X-Forwarded-Proto header or request protocol
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol

  // Get the host from X-Forwarded-Host header or request host
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || ''

  // Construct the base URL - ensure protocol has :// format
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

  // Add request information to response headers
  response.headers.set('x-url', request.url)
  response.headers.set('x-host', host)
  response.headers.set('x-protocol', protocol)
  response.headers.set('x-base-url', baseUrl)

  // Debug cookie and header conversion
  const privyToken = request.cookies.get('privy-token')?.value
  console.log('Middleware - url:', request.url)
  console.log('Middleware - Cookie present:', !!privyToken)
  if (privyToken) {
    console.log('Middleware - Setting Authorization header')
    response.headers.set('authorization', `Bearer ${privyToken}`)
  } else {
    console.log('Middleware - No privy-token cookie found')
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
