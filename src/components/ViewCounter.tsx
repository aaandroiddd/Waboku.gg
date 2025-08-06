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
  
  // Show view count as text for all users
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground">
        {viewCount} view{viewCount !== 1 ? 's' : ''}
      </span>
      {accountTier === 'premium' && (
        <HelpTooltip content="Number of views this listing has received" />
      )}
    </div>
  );
};