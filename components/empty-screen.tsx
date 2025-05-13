import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Globe2,
  Link,
  Youtube,
  type LucideIcon
} from 'lucide-react'

const exampleMessages: {
  heading: string
  message: string
  icon: LucideIcon
  iconAriaLabel: string
}[] = [
  {
    heading: 'Explore yield opportunities on Pendle',
    message: 'List the yielding opportunities on Pendle',
    icon: Globe2,
    iconAriaLabel: 'Web search'
  },
  {
    heading: 'Explain how airdrop works',
    message: 'Explain the purpose of airdrop and common ways of participating',
    icon: Globe2,
    iconAriaLabel: 'Web search'
  },
  {
    heading: 'Find videos explaining Pendle protocol',
    message: 'Find videos explaining how Pendle protocol work',
    icon: Youtube,
    iconAriaLabel: 'Video search'
  },
  {
    heading: 'Summary: https://docs.pendle.finance/ProtocolMechanics/Glossary',
    message: 'Summary: https://docs.pendle.finance/ProtocolMechanics/Glossary',
    icon: Link,
    iconAriaLabel: 'Summarize link'
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  return (
    <div className={`w-full transition-all min-h-[150px] ${className}`}>
      <div className="bg-background p-1.5 sm:p-2 md:p-2 lg:p-4">
        <div className="mt-2 sm:mt-2 md:mt-2 flex flex-col items-start space-y-3 sm:space-y-3 md:space-y-3 mb-2 sm:mb-2 md:mb-4">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-[12px] sm:text-xs md:text-sm lg:text-base whitespace-normal text-left flex items-start"
              name={message.message}
              onClick={async () => {
                submitMessage(message.message)
              }}
            >
              <ArrowRight
                size={14}
                className="mr-2 sm:mr-2 md:mr-2 text-muted-foreground shrink-0 min-w-[14px]"
              />
              <message.icon
                size={22}
                className="mr-2 sm:mr-2 md:mr-2 text-muted-foreground shrink-0 min-w-[14px]"
                aria-label={message.iconAriaLabel}
              />
              <span className="text-left line-clamp-3 max-w-[270px] sm:max-w-none break-all sm:break-normal">
                {message.heading}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
