import { ReactNode } from 'react';
import { LoadingAnimation } from './LoadingAnimation';
import { cn } from '@/lib/utils';

interface ContentLoaderProps {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  loadingMessage?: string;
  fallback?: ReactNode;
  minHeight?: string;
}

export function ContentLoader({
  isLoading,
  children,
  className,
  loadingMessage,
  fallback,
  minHeight = '200px'
}: ContentLoaderProps) {
  if (isLoading) {
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