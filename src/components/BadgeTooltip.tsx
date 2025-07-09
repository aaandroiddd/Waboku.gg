import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { hasClass } from '@/lib/string-utils';

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
  // Use safe string utility to check for cursor-pointer class
  const childHasCursorPointer = React.isValidElement(children) && 
    children.props && 
    hasClass(children.props.className, 'cursor-pointer');

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={`inline-flex ${childHasCursorPointer ? 'cursor-pointer' : 'cursor-help'}`}>
            {children}
          </span>
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