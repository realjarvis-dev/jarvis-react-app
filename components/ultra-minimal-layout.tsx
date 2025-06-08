import { ReactNode } from 'react'

interface UltraMinimalLayoutProps {
  children: ReactNode
}

// Ultra-minimal layout with zero dependencies
export function UltraMinimalLayout({ children }: UltraMinimalLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Jarvis - AI Investment Assistant</title>
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