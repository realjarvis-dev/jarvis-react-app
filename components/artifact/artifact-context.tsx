'use client'

import { createContext, useContext, useState } from 'react'

interface ArtifactContextType {
  open: (params: any) => void
  close: () => void
  isOpen: boolean
}

const ArtifactContext = createContext<ArtifactContextType | null>(null)

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = (params: any) => {
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
  }

  return (
    <ArtifactContext.Provider value={{ open, close, isOpen }}>
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifact() {
  const context = useContext(ArtifactContext)
  if (!context) {
    throw new Error('useArtifact must be used within ArtifactProvider')
  }
  return context
}