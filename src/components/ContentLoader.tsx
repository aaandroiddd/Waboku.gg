import { ReactNode, useState, useEffect } from 'react';
import { LoadingAnimation } from './LoadingAnimation';
import { cn } from '@/lib/utils';

interface ContentLoaderProps {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  loadingMessage?: string;
  fallback?: ReactNode;
  minHeight?: string;
  delay?: number;
}

export function ContentLoader({
  isLoading,
  children,
  className,
  loadingMessage,
  fallback,
  minHeight = '200px',
  delay = 200
}: ContentLoaderProps) {
  const [showLoader, setShowLoader] = useState(false);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isLoading) {
      // Only show loader after a delay to prevent flashing for quick loads
      timer = setTimeout(() => {
        setShowLoader(true);
      }, delay);
    } else {
      setShowLoader(false);
    }
    
    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, delay]);
  
  if (isLoading) {
    // If we're loading but haven't hit the delay threshold yet, show nothing
    if (!showLoader) {
      return <div style={{ minHeight }}></div>;
    }
    
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div 
        className={cn(
          "flex flex-col items-center justify-center w-full transition-opacity duration-300",
          className
        )}
        style={{ minHeight }}
      >
        <LoadingAnimation color="var(--theme-primary, #000)" size="40" />
        {loadingMessage && (
          <p className="mt-4 text-sm text-muted-foreground animate-pulse">{loadingMessage}</p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}