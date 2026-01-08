import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  /**
   * IMPORTANT:
   * In Next.js middleware, if you want to pass data “forward” to the app/router,
   * you should mutate the *request headers* via `NextResponse.next({ request: { headers }})`.
   * Setting auth-like headers (e.g. `authorization`) on the *response* can cause
   * undefined behavior in some hosting environments and has been observed to
   * trigger `ERR_HTTP_HEADERS_SENT`.
   */

  const requestHeaders = new Headers(request.headers)

  const code = request.nextUrl.searchParams.get('privy_oauth_code')
  if (code) {
    console.log('Middleware saw OAuth code:', code)
    requestHeaders.set('x-privy-oauth-code', code)
  }

  // Get the protocol from X-Forwarded-Proto header or request protocol
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol

  // Get the host from X-Forwarded-Host header or request host
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || ''

  // Construct the base URL - ensure protocol has :// format
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

  // Add request information to request headers (for server components / route handlers)
  requestHeaders.set('x-url', request.url)
  requestHeaders.set('x-host', host)
  requestHeaders.set('x-protocol', protocol)
  requestHeaders.set('x-base-url', baseUrl)

  // Debug cookie and header conversion
  const privyToken = request.cookies.get('privy-token')?.value
  console.log('Middleware - url:', request.url)
  console.log('Middleware - Cookie present:', !!privyToken)

  // If you need an auth token for downstream route handlers, attach it to the request.
  // Note: your server code can also read `cookies()` directly; this header is optional.
  if (privyToken) {
    console.log('Middleware - Attaching Authorization header to request')
    requestHeaders.set('authorization', `Bearer ${privyToken}`)
  } else {
    console.log('Middleware - No privy-token cookie found')
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
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
