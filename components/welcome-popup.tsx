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
      <DialogContent className="max-w-[90%] w-full sm:max-w-[525px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-xl sm:text-2xl">
            Welcome to Jarvis
          </DialogTitle>
          <DialogDescription className="text-center pt-2 text-sm sm:text-base">
            Allow Jarvis to perform sensitive actions on your behalf. You can
            change this later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
          <p className="mb-2 sm:mb-3 text-base sm:text-lg font-medium">Jarvis would like to</p>
          <ul className="space-y-3 sm:space-y-4">
            <li className="flex items-start sm:items-center">
              <Check color="#4CAF50" size={20} className="mr-2 sm:mr-3 mt-0.5 sm:mt-0 shrink-0" />
              <span className="text-gray-500 text-sm sm:text-lg">
                Execute onchain actions for you
              </span>
            </li>
            <li className="flex items-start sm:items-center">
              <Check color="#4CAF50" size={20} className="mr-2 sm:mr-3 mt-0.5 sm:mt-0 shrink-0" />
              <span className="text-gray-500 text-sm sm:text-lg">
                Transactions are capped at $20
              </span>
            </li>
          </ul>
        </div>
        <DialogFooter className="sm:justify-center mt-2 sm:mt-0">
          <Button onClick={onClose} className="w-full text-sm sm:text-base py-1.5 h-auto sm:h-10">
            Got it!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default WelcomePopup
