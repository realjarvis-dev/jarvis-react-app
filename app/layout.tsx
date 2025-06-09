// Restored original layout with performance optimizations
import AppSidebar from '@/components/app-sidebar'
import { ArtifactProvider } from '@/components/artifact/artifact-context'
import ArtifactRoot from '@/components/artifact/artifact-root'
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
  display: 'swap',
  preload: true
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

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
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
                <ArtifactProvider>
                  <AppSidebar />
                  <div className="flex flex-1 min-w-0">
                    <ArtifactRoot>
                      <main className="w-full h-screen flex flex-col overflow-hidden">
                        {children}
                      </main>
                    </ArtifactRoot>
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