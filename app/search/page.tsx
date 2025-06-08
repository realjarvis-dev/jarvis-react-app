import { UltraMinimalChat } from '@/components/ultra-minimal-chat'
import { redirect } from 'next/navigation'

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  const id = 'search-chat'
  return <UltraMinimalChat id={id} />
}