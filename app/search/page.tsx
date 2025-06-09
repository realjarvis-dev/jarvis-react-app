import { RestoredChat } from '@/components/restored-chat'
import { generateId } from 'ai'
import { redirect } from 'next/navigation'

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  const id = generateId()
  return <RestoredChat id={id} query={q} />
}