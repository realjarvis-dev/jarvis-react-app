import { UltraMinimalChat } from '@/components/ultra-minimal-chat'

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  return {
    title: `Shared Chat ${id.slice(0, 50)}`
  }
}

export default async function SharePage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  // Ultra-minimal version to avoid all dependencies
  return <UltraMinimalChat id={id} />
}