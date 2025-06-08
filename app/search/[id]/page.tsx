import { UltraMinimalChat } from '@/components/ultra-minimal-chat'

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const { id } = params

  return {
    title: `Chat ${id.slice(0, 50)}`,
    description: 'A conversation with Jarvis'
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const { id } = params

  // Ultra-minimal version to avoid all dependencies
  return <UltraMinimalChat id={id} />
}