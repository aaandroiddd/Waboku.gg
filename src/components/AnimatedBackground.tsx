import React, { useEffect, useRef, useState, useCallback } from 'react';

interface AnimatedBackgroundProps {
  className?: string;
}

interface Card {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  scale: number;
  scaleDirection: number;
  moveX: number;
  moveY: number;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);
  const cardsRef = useRef<Card[]>([]);
  const frameCountRef = useRef(0);
  
  // Detect device capabilities
  const detectDeviceCapabilities = useCallback(() => {
    // Check if we're on a mobile device
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    
    // Check for low-end devices based on hardware concurrency
    // Most low-end mobile devices have 4 or fewer cores
    const lowEnd = mobile && (
      navigator.hardwareConcurrency === undefined || 
      navigator.hardwareConcurrency <= 4
    );
    setIsLowEndDevice(lowEnd);
    
    return { mobile, lowEnd };
  }, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    // Detect device capabilities
    const { mobile, lowEnd } = detectDeviceCapabilities();
    
    // Set initial canvas dimensions with proper device pixel ratio handling
    const updateCanvasDimensions = () => {
      const pixelRatio = mobile ? 1 : (window.devicePixelRatio || 1);
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      
      // Set canvas size with pixel ratio consideration
      canvas.width = displayWidth * pixelRatio;
      canvas.height = displayHeight * pixelRatio;
      
      // Scale the context to ensure correct drawing dimensions
      ctx.scale(pixelRatio, pixelRatio);
      
      // Set CSS size
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };
    
    updateCanvasDimensions();
    
    // Throttled resize handler for better performance
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      // Cancel previous resize timeout
      clearTimeout(resizeTimeout);
      
      // Set a timeout to handle resize after user stops resizing
      resizeTimeout = setTimeout(() => {
        const { mobile: newMobile } = detectDeviceCapabilities();
        updateCanvasDimensions();
        // Recreate cards when canvas is resized to ensure proper distribution
        initializeCards(newMobile);
      }, mobile ? 300 : 200); // Longer delay on mobile for better performance
    };
    
    // Initialize cards with proper positioning
    const initializeCards = (isMobileDevice: boolean) => {
      // Clear existing cards
      cardsRef.current = [];
      
      // Reduce card count on mobile for better performance
      // Further reduce for low-end devices
      const cardCount = lowEnd 
        ? Math.min(2, Math.floor(window.innerWidth / 400))
        : isMobileDevice 
          ? Math.min(3, Math.floor(window.innerWidth / 300)) 
          : Math.min(8, Math.floor(window.innerWidth / 200));
      
      for (let i = 0; i < cardCount; i++) {
        // Smaller cards on mobile
        const width = isMobileDevice ? (50 + Math.random() * 30) : (60 + Math.random() * 40);
        const height = width * 1.4; // Card aspect ratio
        
        // Slower movement and rotation on mobile
        const speedFactor = isMobileDevice ? 0.5 : 1;
        const rotationSpeed = (Math.random() - 0.5) * 0.1 * speedFactor;
        const moveSpeed = (Math.random() - 0.5) * 0.1 * speedFactor;
        
        cardsRef.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          width,
          height,
          rotation: Math.random() * 360,
          rotationSpeed,
          opacity: isMobileDevice ? (0.01 + Math.random() * 0.02) : (0.02 + Math.random() * 0.03), // Lower opacity on mobile
          color: getRandomColor(),
          scale: 0.8 + Math.random() * 0.4,
          scaleDirection: Math.random() > 0.5 ? 1 : -1,
          moveX: moveSpeed,
          moveY: moveSpeed
        });
      }
    };
    
    function getRandomColor() {
      const colors = [
        '#3B82F6', // Blue
        '#2563EB', // Darker blue
        '#1E40AF', // Even darker blue
        '#1D4ED8', // Royal blue
        '#0284C7', // Sky blue
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Initialize cards
    initializeCards(mobile);
    
    // Animation variables
    let animationFrameId: number;
    let lastFrameTime = 0;
    
    // Adjust target FPS based on device capability
    const targetFPS = lowEnd ? 20 : (mobile ? 30 : 60);
    const frameInterval = 1000 / targetFPS;
    
    // Visibility change detection
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    
    // Intersection Observer with lower threshold for mobile
    const observerThreshold = mobile ? 0.05 : 0.1;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: observerThreshold }
    );
    
    observer.observe(canvas);
    
    // Animation loop with frame rate control and mobile optimizations
    const render = (timestamp: number) => {
      // Skip rendering if not visible
      if (!isVisible) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }
      
      // Control frame rate
      const elapsed = timestamp - lastFrameTime;
      if (elapsed < frameInterval) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }
      
      lastFrameTime = timestamp - (elapsed % frameInterval);
      frameCountRef.current++;
      
      // Clear canvas
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      
      // On mobile, only update animation every other frame for better performance
      const shouldUpdatePositions = !mobile || (frameCountRef.current % 2 === 0);
      
      // Draw cards
      cardsRef.current.forEach(card => {
        // Update card position and rotation - only on certain frames for mobile
        if (shouldUpdatePositions) {
          card.rotation += card.rotationSpeed;
          card.x += card.moveX;
          card.y += card.moveY;
          
          // Bounce off edges
          if (card.x < -card.width) card.x = window.innerWidth + card.width;
          if (card.x > window.innerWidth + card.width) card.x = -card.width;
          if (card.y < -card.height) card.y = window.innerHeight + card.height;
          if (card.y > window.innerHeight + card.height) card.y = -card.height;
          
          // Subtle scale animation - reduced frequency and only on certain frames
          if (frameCountRef.current % 4 === 0) {
            card.scale += 0.0002 * card.scaleDirection;
            if (card.scale > 1.2 || card.scale < 0.8) {
              card.scaleDirection *= -1;
            }
          }
        }
        
        // Draw card with hardware acceleration hints
        ctx.save();
        ctx.translate(card.x, card.y);
        ctx.rotate((card.rotation * Math.PI) / 180);
        ctx.scale(card.scale, card.scale);
        ctx.globalAlpha = card.opacity;
        
        // Card outline - simplified for mobile
        ctx.strokeStyle = card.color;
        ctx.lineWidth = mobile ? 0.5 : 1; // Thinner lines on mobile
        ctx.beginPath();
        ctx.roundRect(-card.width / 2, -card.height / 2, card.width, card.height, 8);
        ctx.stroke();
        
        // Card inner frame - only draw on desktop or every 3rd frame on mobile
        if (!mobile || frameCountRef.current % 3 === 0) {
          ctx.beginPath();
          ctx.roundRect(-card.width / 2 + 5, -card.height / 2 + 5, card.width - 10, card.height / 2 - 10, 4);
          ctx.stroke();
        }
        
        ctx.restore();
      });
      
      animationFrameId = window.requestAnimationFrame(render);
    };
    
    // Start animation
    animationFrameId = window.requestAnimationFrame(render);
    
    // Set up event listeners with passive option for better touch performance
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimeout);
    };
  }, [detectDeviceCapabilities, isVisible]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 will-change-transform ${className || ''}`}
      style={{ transform: 'translateZ(0)' }} // Force hardware acceleration
      aria-hidden="true"
    />
  );
};

export default AnimatedBackground;