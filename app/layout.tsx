import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
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
  metadataBase: new URL('https://app.thejarvis.xyz'),
  title,
  description,
  openGraph: {
    title,
    description,
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Jarvis - Unifying Web3 with autonomous agent'
      }
    ]
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@JarvisCryptoAI'
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
          <NetworkProvider>
            <WrappedPrivyProvider>
              <QueryProvider>
                <SidebarProvider defaultOpen={false}>
                  <AppSidebar />
                  <div className="flex flex-col flex-1 min-w-0">
                    <Header />
                    <main className="flex flex-1 min-h-0">
                      <ArtifactRoot>{children}</ArtifactRoot>
                    </main>
                  </div>
                </SidebarProvider>
              </QueryProvider>
            </WrappedPrivyProvider>
          </NetworkProvider>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
