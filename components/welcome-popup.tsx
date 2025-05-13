import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Check } from 'lucide-react'
import React from 'react'

interface WelcomePopupProps {
  onClose: () => void
  open: boolean
}

const WelcomePopup: React.FC<WelcomePopupProps> = ({ onClose, open }) => {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            Welcome to Jarvis-Investment-Agent
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            Allow Jarvis to perform sensitive actions on your behalf. You can
            change this later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="mb-3 text-lg font-medium">Jarvis would like to</p>
          <ul className="space-y-4">
            <li className="flex items-center">
              <Check color="#4CAF50" size={24} className="mr-3" />
              <span className="text-gray-500 text-lg">
                Execute onchain actions for you
              </span>
            </li>
            <li className="flex items-center">
              <Check color="#4CAF50" size={24} className="mr-3" />
              <span className="text-gray-500 text-lg">
                Transactions are capped at $20
              </span>
            </li>
          </ul>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Got it!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default WelcomePopup
