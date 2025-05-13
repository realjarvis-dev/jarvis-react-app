'use client'
import { Button } from './ui/button'
import { useRouter } from 'next/navigation'

export function DashboardButton() {
  const router = useRouter()

  return (
    <Button variant="outline" onClick={() => router.push('/dashboard')}>
      Dashboard
    </Button>
  )
}