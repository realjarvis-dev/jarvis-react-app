import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Copy } from "lucide-react";

export const CopyableWalletAddressSkeleton = ({
  className
}: {
  className?: string
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground animate-pulse',
        className
      )}
    >
      {/* Intro text placeholder */}
      <div className="h-4 w-40 bg-muted-foreground/20 rounded-md"></div>

      {/* Wallet address placeholder */}
      <div className="h-4 w-24 bg-muted-foreground/20 rounded-md"></div>

      {/* Copy button placeholder */}
      <Button
        disabled
        variant="ghost"
        size="icon"
        className="size-6 opacity-50"
        aria-label="Copy wallet address"
      >
        <Copy className="size-3" />
      </Button>
    </div>
  )
}
