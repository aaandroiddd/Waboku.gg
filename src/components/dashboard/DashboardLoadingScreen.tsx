import { useEffect, useState } from 'react';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardLoadingScreenProps {
  isLoading: boolean;
  onLoadComplete: () => void;
  message?: string;
}

export function DashboardLoadingScreen({ 
  isLoading, 
  onLoadComplete, 
  message = "Loading dashboard..." 
}: DashboardLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // Complete the progress bar before hiding
      setProgress(100);
      
      // Add a small delay before hiding to show the completed progress
      const timer = setTimeout(() => {
        setVisible(false);
        onLoadComplete();
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      // Simulate progress for better UX
      setProgress(10);
      const timers = [
        setTimeout(() => setProgress(30), 200),
        setTimeout(() => setProgress(50), 500),
        setTimeout(() => setProgress(70), 800),
        setTimeout(() => setProgress(90), 1200)
      ];
      
      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [isLoading, onLoadComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!visible}
      role="status"
    >
      <div className="flex flex-col items-center justify-center space-y-8 max-w-md w-full px-4">
        <div className="flex flex-col items-center">
          <LoadingAnimation size="80" color="var(--theme-primary, #000)" />
          <h2 className="text-2xl font-bold mt-6 mb-2">Loading Dashboard</h2>
          {user && <p className="text-muted-foreground">Welcome back, {user.displayName || 'User'}</p>}
        </div>
        
        <div className="w-full space-y-3">
          <Progress value={progress} className="h-2 w-full" />
          <p className="text-center text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}