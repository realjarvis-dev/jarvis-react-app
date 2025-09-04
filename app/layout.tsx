import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import { PriceAlertProvider } from '@/components/price-alert-provider'
import WrappedPrivyProvider from '@/components/privy-provider'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { NetworkProvider } from '@/lib/network/context'
import { cn } from '@/lib/utils'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = 'Jarvis'
const description = 'Unifying Web3 with autonomous agent.'

export const metadata: Metadata = {
  metadataBase: new URL('https://jarvis-investment-agent.onrender.com'),
  title,
  description,
  openGraph: {
    title,
    description,
    images: ['/opengraph-image.png?v=20250627-1']
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@JarvisCryptoAI',
    images: ['/opengraph-image.png?v=20250627-1']
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content'
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen flex flex-col font-sans antialiased',
          fontSans.variable
        )}
        suppressHydrationWarning
      >
        
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem={false}
              disableTransitionOnChange
            >
              <NetworkProvider>
                <WrappedPrivyProvider>
                <PriceAlertProvider>
                  <SidebarProvider defaultOpen={false}>
                    <AppSidebar />
                    <div className="flex flex-col flex-1 min-w-0">
                      <Header />
                      <main className="flex-1 w-full">
                        <ArtifactRoot>{children}</ArtifactRoot>
                      </main>
                    </div>
                  </SidebarProvider>
                  </PriceAlertProvider>
                </WrappedPrivyProvider>
              </NetworkProvider>
              <Toaster />
              <Analytics />
            </ThemeProvider>
          </QueryProvider>
        
      </body>
    </html>
  )
}
