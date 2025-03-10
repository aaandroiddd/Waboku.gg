import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  size?: 'sm' | 'md' | 'lg';
}

export function HelpTooltip({ 
  content, 
  side = 'top', 
  align = 'center',
  size = 'sm'
}: HelpTooltipProps) {
  const sizeMap = {
    sm: 14,
    md: 16,
    lg: 18
  };
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle size={sizeMap[size]} />
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          align={align}
          className="max-w-[250px] text-sm"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}