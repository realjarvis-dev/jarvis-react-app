// Ultra-minimal layout to eliminate all render blocking
import type { Metadata, Viewport } from 'next'

const title = 'Jarvis'
const description = 'Autonomous AI that opens investing to all.'

export const metadata: Metadata = {
  title,
  description
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              overflow: hidden;
            }
          `
        }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}