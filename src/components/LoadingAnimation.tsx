import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    // Only load the animation on the client side
    setIsClient(true);
    
    // Only import and register the animation on desktop
    if (!isMobile) {
      import('ldrs').then(({ dotStream }) => {
        dotStream.register();
      });
    }
    
    // Add a small delay before showing the animation to enable the fade-in effect
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isMobile]);

  if (!isClient) return null;

  // On mobile, show a simple static loading indicator
  if (isMobile) {
    return (
      <div className={cn(
        "flex justify-center items-center",
        className
      )}>
        <div 
          className="rounded-full border-2 border-gray-300 border-t-blue-600"
          style={{ 
            width: `${size}px`, 
            height: `${size}px`,
          }}
        />
      </div>
    );
  }

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