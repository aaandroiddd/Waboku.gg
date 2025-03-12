import { LoadingAnimation } from './LoadingAnimation';

interface GlobalLoadingProps {
  fullScreen?: boolean;
  message?: string;
}

export function GlobalLoading({ fullScreen = true, message }: GlobalLoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${
      fullScreen ? 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm' : 'w-full py-8'
    }`}>
      <LoadingAnimation 
        color="var(--theme-primary, #000)" 
        className="my-4"
      />
      {message && (
        <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
      )}
    </div>
  );
}