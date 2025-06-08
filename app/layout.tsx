import AppSidebar from '@/components/app-sidebar'
import { ArtifactProvider } from '@/components/artifact/artifact-context'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import { PerformanceMonitor } from '@/components/performance-monitor'
import { FallbackPrivyProvider as DeferredPrivyProvider } from '@/components/fallback-privy-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { LightweightNetworkProvider } from '@/components/lightweight-network-provider'
import { cn } from '@/lib/utils'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'
const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap', // Use font-display: swap for better LCP
  preload: true // Preload the font for faster loading
})

const title = 'Jarvis'
const description = 'Autonomous AI that opens investing to all.'

export const metadata: Metadata = {
  metadataBase: new URL('https://jarvis-investment-agent.onrender.com'),
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@frfrcrypto'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
}

// Enable static optimization for better LCP
// export const dynamic = 'force-dynamic' // Removed to improve performance

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Critical resource hints for Slow 4G optimization */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        
        {/* Critical CSS inline to avoid network request */}
        <style dangerouslySetInnerHTML={{
          __html: `
            body { font-family: system-ui, -apple-system, sans-serif; }
            .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
          `
        }} />
      </head>
      <body
        className={cn(
          'min-h-screen flex flex-col font-sans antialiased',
          fontSans.variable
        )}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LightweightNetworkProvider>
            <DeferredPrivyProvider>
              <SidebarProvider defaultOpen={false}>
                {/* Wrap the main content (that eventually renders ChatPanel)
                    with ArtifactProvider */}
                <ArtifactProvider>
                  <AppSidebar />
                  {/* <Header /> */}
                  <div
                    className="flex flex-col flex-1 overflow-hidden pt-[56px] px-4 sm:px-6"
                    style={{
                      paddingTop: `calc(56px + env(safe-area-inset-top))`
                    }}
                  >
                    <main className="flex-1 w-full overflow-auto">
                      <ArtifactRoot>{children}</ArtifactRoot>
                    </main>
                  </div>
                </ArtifactProvider>
              </SidebarProvider>
            </DeferredPrivyProvider>
          </LightweightNetworkProvider>
          <Toaster />
          <Analytics />
          <PerformanceMonitor />
        </ThemeProvider>
      </body>
    </html>
  )
}
