import React, { useEffect, useRef, useState } from 'react';

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
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    // Check if we're on a mobile device
    const isMobile = window.innerWidth < 768;
    
    // Set initial canvas dimensions
    const updateCanvasDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    updateCanvasDimensions();
    
    // Debounce resize handler for better performance
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        updateCanvasDimensions();
        // Recreate cards when canvas is resized to ensure proper distribution
        initializeCards();
      }, 200);
    };
    
    // Card shapes
    let cards: Card[] = [];
    
    // Initialize cards with proper positioning
    const initializeCards = () => {
      // Clear existing cards
      cards = [];
      
      // Reduce card count on mobile for better performance
      const cardCount = isMobile 
        ? Math.min(4, Math.floor(window.innerWidth / 250)) 
        : Math.min(10, Math.floor(window.innerWidth / 200));
      
      for (let i = 0; i < cardCount; i++) {
        const width = 60 + Math.random() * 40;
        const height = width * 1.4; // Card aspect ratio
        
        cards.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          width,
          height,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 0.1, // Reduced rotation speed
          opacity: 0.02 + Math.random() * 0.03, // Reduced opacity
          color: getRandomColor(),
          scale: 0.8 + Math.random() * 0.4,
          scaleDirection: Math.random() > 0.5 ? 1 : -1,
          moveX: (Math.random() - 0.5) * 0.1, // Reduced movement speed
          moveY: (Math.random() - 0.5) * 0.1  // Reduced movement speed
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
    initializeCards();
    
    // Animation variables
    let animationFrameId: number;
    let lastFrameTime = 0;
    const targetFPS = isMobile ? 30 : 60; // Lower FPS on mobile
    const frameInterval = 1000 / targetFPS;
    
    // Visibility change detection
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    
    // Intersection Observer to pause animation when not in viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );
    
    observer.observe(canvas);
    
    // Animation loop with frame rate control
    const render = (timestamp: number) => {
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
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw cards
      cards.forEach(card => {
        // Update card position and rotation
        card.rotation += card.rotationSpeed;
        card.x += card.moveX;
        card.y += card.moveY;
        
        // Bounce off edges
        if (card.x < -card.width) card.x = canvas.width + card.width;
        if (card.x > canvas.width + card.width) card.x = -card.width;
        if (card.y < -card.height) card.y = canvas.height + card.height;
        if (card.y > canvas.height + card.height) card.y = -card.height;
        
        // Subtle scale animation - reduced frequency
        card.scale += 0.0002 * card.scaleDirection;
        if (card.scale > 1.2 || card.scale < 0.8) {
          card.scaleDirection *= -1;
        }
        
        // Draw card
        ctx.save();
        ctx.translate(card.x, card.y);
        ctx.rotate((card.rotation * Math.PI) / 180);
        ctx.scale(card.scale, card.scale);
        ctx.globalAlpha = card.opacity;
        
        // Card outline
        ctx.strokeStyle = card.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-card.width / 2, -card.height / 2, card.width, card.height, 8);
        ctx.stroke();
        
        // Card inner frame - simplified for better performance
        ctx.beginPath();
        ctx.roundRect(-card.width / 2 + 5, -card.height / 2 + 5, card.width - 10, card.height / 2 - 10, 4);
        ctx.stroke();
        
        ctx.restore();
      });
      
      animationFrameId = window.requestAnimationFrame(render);
    };
    
    // Start animation
    animationFrameId = window.requestAnimationFrame(render);
    
    // Set up event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimeout);
    };
  }, [isVisible]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 ${className || ''}`}
      aria-hidden="true"
    />
  );
};

export default AnimatedBackground;