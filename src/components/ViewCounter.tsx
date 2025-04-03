import React from 'react';
import { Eye } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/HelpTooltip';

interface ViewCounterProps {
  viewCount?: number;
  className?: string;
}

export const ViewCounter: React.FC<ViewCounterProps> = ({ viewCount = 0, className = '' }) => {
  const { accountTier } = useAccount();
  
  // Only premium users can see view counts
  if (accountTier !== 'premium') {
    return null;
  }
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-6 text-xs">
        <Eye className="h-3 w-3" />
        <span>{viewCount}</span>
        <HelpTooltip content="Number of views this listing has received" />
      </Badge>
    </div>
  );
};