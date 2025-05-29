'use client'

import { cn } from '@/lib/utils'
import {
  usePrivy
} from '@privy-io/react-auth'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, MessageCirclePlus, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { RefObject, useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { toast } from 'sonner'
import { useArtifact } from './artifact/artifact-context'
import { SuggestionPills } from './chat-panel/suggestion-pills'
import { LazyWallet } from './wallet'

import { MarketPulse } from './market-pulse'

import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { VideoBackground } from './ui/video-background'
import { WelcomeMessage } from './welcome-messages'
import { PerformanceMonitor } from './performance-monitor'
