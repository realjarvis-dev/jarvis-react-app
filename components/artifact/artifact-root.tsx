'use client'

import { ArtifactProvider } from './artifact-context'

interface ArtifactRootProps {
  children: React.ReactNode
}

export default function ArtifactRoot({ children }: ArtifactRootProps) {
  return (
    <ArtifactProvider>
      <div className="w-full h-screen flex flex-col overflow-hidden">
        <main className="w-full h-screen flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </ArtifactProvider>
  )
}