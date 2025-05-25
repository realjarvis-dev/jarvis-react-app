'use client';

import { cn } from '@/lib/utils'; // Assuming you have a cn utility
import { BarChart3, Building, Lightbulb, LineChart, Receipt, TrendingUp, Users2, Zap } from 'lucide-react';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

interface SuggestionPillsProps {
  onSelectSuggestion: (suggestion: string) => void;
}

interface Suggestion {
  text: string;
  icon: JSX.Element;
}

// Helper hook for individual row animation logic
function useScrollingAnimation(containerRef: RefObject<HTMLDivElement>, isGloballyPaused: boolean) {
  const animationRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);

  const animate = useCallback(() => {
    if (!containerRef.current || isGloballyPaused) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    
    const container = containerRef.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    if (scrollWidth <= clientWidth) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    scrollPositionRef.current += 0.5; 
    
    const trueScrollableWidth = scrollWidth / 2; 
    if (scrollPositionRef.current >= trueScrollableWidth) {
      scrollPositionRef.current = 0;
    }
    
    container.scrollLeft = scrollPositionRef.current;
    animationRef.current = requestAnimationFrame(animate);
  }, [isGloballyPaused, containerRef]);

  useEffect(() => {
    if (!isGloballyPaused) {
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, isGloballyPaused]);
}


export function SuggestionPills({ onSelectSuggestion }: SuggestionPillsProps) {
  const [isHoverPaused, setIsHoverPaused] = useState(false);

  const suggestionsRow1: Suggestion[] = [
    { text: "Check my ETH wallet balance", icon: <Receipt className="size-3.5 stroke-current" /> },
    { text: "Swap 0.1 ETH for eETH PT on Pendle", icon: <TrendingUp className="size-3.5 stroke-current" /> },
    { text: "Show top Pendle YT yields", icon: <BarChart3 className="size-3.5 stroke-current" /> },
    { text: "What's the current gas fee?", icon: <Zap className="size-3.5 stroke-current" /> }, // New
    { text: "Explore DeFi yield farming options", icon: <Building className="size-3.5 stroke-current" /> }, // New
  ];

  const suggestionsRow2: Suggestion[] = [
    { text: "Send 0.05 ETH to vitalik.eth", icon: <Zap className="size-3.5 stroke-current" /> },
    { text: "What are Pendle's Principal Tokens?", icon: <Lightbulb className="size-3.5 stroke-current" /> },
    { text: "Explain fixed yield on Pendle", icon: <Building className="size-3.5 stroke-current" /> },
    { text: "Batch send ETH to multiple wallets", icon: <Users2 className="size-3.5 stroke-current" /> },
    { text: "Compare Pendle PT vs YT returns", icon: <LineChart className="size-3.5 stroke-current" /> },
  ];

  const containerRefRow1 = useRef<HTMLDivElement>(null);
  const containerRefRow2 = useRef<HTMLDivElement>(null);

  useScrollingAnimation(containerRefRow1, isHoverPaused);
  useScrollingAnimation(containerRefRow2, isHoverPaused);

  const renderRow = (
    suggestions: Suggestion[], 
    containerRef: RefObject<HTMLDivElement>, 
    rowKey: string,
    isOffset: boolean // New parameter to indicate if this row should be offset
  ) => {
    const displaySuggestions = suggestions.length > 2 ? [...suggestions, ...suggestions] : suggestions; 

    return (
      <div className="relative w-full">
        <div className="absolute left-0 top-0 h-full w-8 sm:w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-8 sm:w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
        <div 
          ref={containerRef}
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-hidden whitespace-nowrap py-1"
        >
          {/* Apply conditional padding to this inner div for the offset effect */}
          <div className={cn(
            "inline-flex gap-1.5 sm:gap-2 items-center",
            isOffset ? "pr-4 pl-10 sm:pl-12 md:pl-16" : "px-4" // e.g. pl-10 is 2.5rem, pl-12 is 3rem, pl-16 is 4rem
          )}>
            {displaySuggestions.map((suggestion, index) => (
              <button
                key={`${rowKey}-${suggestion.text}-${index}`}
                type="button"
                onClick={() => onSelectSuggestion(suggestion.text)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5
                           rounded-full bg-white/5 hover:bg-white/10
                           text-[10px] sm:text-xs text-white/90 whitespace-nowrap transition-colors
                           border border-white/10"
              >
                {suggestion.icon}
                <span className="max-w-[120px] sm:max-w-none truncate">
                  {suggestion.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="w-full mt-2 flex flex-col gap-1 sm:gap-1.5"
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
      onFocusCapture={() => setIsHoverPaused(true)}
      onBlurCapture={() => setIsHoverPaused(false)}
      onTouchStart={() => setIsHoverPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsHoverPaused(false), 1000)}
    >
      {renderRow(suggestionsRow1, containerRefRow1, "row1", false)} {/* First row, no offset */}
      {renderRow(suggestionsRow2, containerRefRow2, "row2", true)}  {/* Second row, with offset */}
    </div>
  );
}