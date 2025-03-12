import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface LoadingAnimationProps {
  size?: string;
  speed?: string;
  color?: string;
  className?: string;
}

export function LoadingAnimation({
  size = "60",
  speed = "2.5",
  color = "black",
  className
}: LoadingAnimationProps) {
  const [isClient, setIsClient] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only load the animation on the client side
    setIsClient(true);
    
    // Import and register the animation
    import('ldrs').then(({ dotStream }) => {
      dotStream.register();
    });
    
    // Add a small delay before showing the animation to enable the fade-in effect
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  if (!isClient) return null;

  return (
    <div className={cn(
      "flex justify-center items-center transition-opacity duration-500",
      isVisible ? "opacity-100" : "opacity-0",
      className
    )}>
      <l-dot-stream
        size={size}
        speed={speed}
        color={color}
      ></l-dot-stream>
    </div>
  );
}