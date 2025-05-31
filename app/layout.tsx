import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import WrappedPrivyProvider from '@/components/privy-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { NetworkProvider } from '@/lib/context/network-context'
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
}: Readonly<{
  children: React.ReactNode
}>) {
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

          enableSystem={false} // Set enableSystem to false

          // enableSystem

          disableTransitionOnChange
        >
          <NetworkProvider>
            <WrappedPrivyProvider>
              <SidebarProvider defaultOpen={false}>
                <AppSidebar />
                <div className="flex flex-col flex-1 min-w-0">
                  <Header />
                  <main className="flex flex-1 min-h-0 w-full pt-14">
                    <ArtifactRoot>{children}</ArtifactRoot>
                  </main>
                </div>
              </SidebarProvider>
            </WrappedPrivyProvider>
          </NetworkProvider>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
