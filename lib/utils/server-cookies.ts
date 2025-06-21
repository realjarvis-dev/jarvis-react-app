import { cookies } from 'next/headers'
import { Model } from '@/lib/types/models'
import { ChainType } from '@/lib/network/types'
import { USER_SELECTED_NETWORK_COOKIE_KEY, USER_DEMO_MODE_COOKIE_KEY } from '@/lib/network/types'

export interface ServerSideUIState {
  searchMode: boolean
  selectedModel: Model | null
  selectedChain: ChainType
  isDemoMode: boolean
}

export async function getServerSideUIState(): Promise<ServerSideUIState> {
  const cookieStore = await cookies()
  
  const searchMode = cookieStore.get('search-mode')?.value === 'true'
  
  let selectedModel: Model | null = null
  const selectedModelCookie = cookieStore.get('selectedModel')?.value
  if (selectedModelCookie) {
    try {
      selectedModel = JSON.parse(selectedModelCookie) as Model
    } catch (e) {
      console.error('Failed to parse selectedModel cookie:', e)
    }
  }
  
  const selectedChain = (cookieStore.get(USER_SELECTED_NETWORK_COOKIE_KEY)?.value as ChainType) || 'ethereum'
  const isDemoMode = cookieStore.get(USER_DEMO_MODE_COOKIE_KEY)?.value === 'true'
  
  return {
    searchMode,
    selectedModel,
    selectedChain,
    isDemoMode
  }
}
