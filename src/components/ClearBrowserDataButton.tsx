import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clearStoredAuthData } from '@/lib/auth-token-manager';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

interface ClearBrowserDataButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ClearBrowserDataButton({ 
  variant = 'outline', 
  size = 'sm',
  className = ''
}: ClearBrowserDataButtonProps) {
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const handleClearData = () => {
    setIsClearing(true);
    
    try {
      // Clear all stored auth data
      clearStoredAuthData();
      
      // Show success toast
      toast({
        title: "Browser data cleared",
        description: "Authentication data has been cleared. The page will refresh.",
        duration: 3000,
      });
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error clearing browser data:', error);
      
      // Show error toast
      toast({
        title: "Error clearing data",
        description: "There was a problem clearing your browser data. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      
      setIsClearing(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClearData}
      disabled={isClearing}
      className={className}
    >
      {isClearing ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Clearing...
        </>
      ) : (
        <>Fix Browser Data</>
      )}
    </Button>
  );
}