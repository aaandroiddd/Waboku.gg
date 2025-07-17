import React, { useEffect, useRef, useState, useCallback } from 'react';

interface StaticBackgroundProps {
  className?: string;
}

interface StaticCard {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  color: string;
  scale: number;
}

const StaticBackground: React.FC<StaticBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const cardsRef = useRef<StaticCard[]>([]);
  
  // Detect device capabilities
  const detectDeviceCapabilities = useCallback(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    return { mobile };
  }, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      powerPreference: 'low-power'
    });
    if (!ctx) return;
    
    // Detect device capabilities
    const { mobile } = detectDeviceCapabilities();
    
    // Set initial canvas dimensions with proper device pixel ratio handling
    const updateCanvasDimensions = () => {
      const pixelRatio = mobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
    
    // Throttled resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const { mobile: newMobile } = detectDeviceCapabilities();
        updateCanvasDimensions();
        initializeCards(newMobile);
        renderStaticCards();
      }, mobile ? 300 : 200);
    };
    
    // Initialize static cards with fixed positions
    const initializeCards = (isMobileDevice: boolean) => {
      cardsRef.current = [];
      
      // Fewer cards for static version since they don't move
      const cardCount = isMobileDevice ? 6 : 12;
      
      for (let i = 0; i < cardCount; i++) {
        // Smaller cards on mobile
        const width = isMobileDevice ? (35 + Math.random() * 20) : (45 + Math.random() * 30);
        const height = width * 1.4; // Card aspect ratio
        
        const card: StaticCard = {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          width,
          height,
          rotation: Math.random() * 360,
          opacity: isMobileDevice ? (0.01 + Math.random() * 0.02) : (0.02 + Math.random() * 0.03),
          color: getRandomColor(),
          scale: 0.8 + Math.random() * 0.4,
        };
        
        cardsRef.current.push(card);
      }
    };
    
    // Pre-computed color array
    const colors = [
      '#3B82F6', '#2563EB', '#1E40AF', '#1D4ED8', '#0284C7'
    ];
    
    function getRandomColor() {
      return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Initialize cards
    initializeCards(mobile);
    
    // Render static cards once
    const renderStaticCards = () => {
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      
      // Clear canvas
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      
      // Render all cards
      cardsRef.current.forEach(card => {
        ctx.save();
        ctx.translate(card.x, card.y);
        ctx.rotate((card.rotation * Math.PI) / 180);
        ctx.scale(card.scale, card.scale);
        ctx.globalAlpha = card.opacity;
        
        // Draw card outline
        ctx.strokeStyle = card.color;
        ctx.lineWidth = mobile ? 0.4 : 0.8;
        ctx.beginPath();
        ctx.roundRect(-card.width / 2, -card.height / 2, card.width, card.height, 6);
        ctx.stroke();
        
        // Draw inner frame
        ctx.beginPath();
        ctx.roundRect(-card.width / 2 + 4, -card.height / 2 + 4, card.width - 8, card.height / 2 - 8, 3);
        ctx.stroke();
        
        ctx.restore();
      });
    };
    
    // Initial render
    renderStaticCards();
    
    // Set up resize listener
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      cardsRef.current = [];
    };
  }, [detectDeviceCapabilities]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 ${className || ''}`}
      style={{ 
        transform: 'translateZ(0)',
        imageRendering: isMobile ? 'optimizeSpeed' : 'auto'
      }}
      aria-hidden="true"
    />
  );
};

export default StaticBackground;