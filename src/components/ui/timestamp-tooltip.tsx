import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, format } from 'date-fns';

interface TimestampTooltipProps {
  date: Date;
  children?: React.ReactNode;
  className?: string;
  showRelative?: boolean;
}

export const TimestampTooltip: React.FC<TimestampTooltipProps> = ({ 
  date, 
  children, 
  className = "",
  showRelative = true 
}) => {
  const relativeTime = formatDistanceToNow(date);
  const exactTime = format(date, 'PPpp'); // e.g., "Jan 1, 2024 at 3:45:30 PM"
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help ${className}`}>
            {children || (showRelative ? `${relativeTime} ago` : exactTime)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <div className="font-medium">{exactTime}</div>
            {showRelative && (
              <div className="text-xs text-muted-foreground mt-1">
                {relativeTime} ago
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};