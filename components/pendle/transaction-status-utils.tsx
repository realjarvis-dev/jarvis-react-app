import { TransactionStatus } from '@/lib/hooks/use-transaction-status'
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'

interface StatusInfo {
  icon: JSX.Element
  text: string
  color: string
}

export function getPendleTransactionStatusInfo(
  status: TransactionStatus,
  operation: 'zap-in' | 'zap-out'
): StatusInfo {
  const operationText = operation === 'zap-in' ? 'zap in' : 'zap out'

  switch (status) {
    case 'preparing':
      return {
        icon: <Clock className="h-4 w-4" />,
        text: `Preparing ${operationText} transaction`,
        color: 'text-blue-600 dark:text-blue-400'
      }
    case 'building':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: `Building ${operationText} transaction`,
        color: 'text-blue-600 dark:text-blue-400'
      }
    case 'signing':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Signing transaction',
        color: 'text-amber-600 dark:text-amber-400'
      }
    case 'broadcasting':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Broadcasting to network',
        color: 'text-amber-600 dark:text-amber-400'
      }
    case 'confirming':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Waiting for confirmation',
        color: 'text-amber-600 dark:text-amber-400'
      }
    case 'confirmed':
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: `${operationText} transaction confirmed`,
        color: 'text-green-600 dark:text-green-400'
      }
    case 'failed':
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        text: `${operationText} transaction failed`,
        color: 'text-red-600 dark:text-red-400'
      }
    default:
      return {
        icon: <Clock className="h-4 w-4" />,
        text: 'Processing',
        color: 'text-gray-600 dark:text-gray-400'
      }
  }
}
