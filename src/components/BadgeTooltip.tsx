import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BadgeTooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function BadgeTooltip({ 
  children, 
  content, 
  side = 'top', 
  align = 'center' 
}: BadgeTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          align={align}
          className="max-w-[200px] text-center"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}