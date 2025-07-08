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
  isVisible: boolean;
  lastUpdate: number;
}

// Performance monitoring
interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  adaptiveQuality: number;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);
  const cardsRef = useRef<Card[]>([]);
  const frameCountRef = useRef(0);
  const performanceRef = useRef<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    adaptiveQuality: 1.0
  });
  const lastFrameTimeRef = useRef(0);
  const fpsCounterRef = useRef({ frames: 0, lastTime: 0 });
  
  // Performance monitoring function
  const updatePerformanceMetrics = useCallback((timestamp: number) => {
    const counter = fpsCounterRef.current;
    counter.frames++;
    
    if (timestamp - counter.lastTime >= 1000) {
      const fps = Math.round((counter.frames * 1000) / (timestamp - counter.lastTime));
      performanceRef.current.fps = fps;
      performanceRef.current.frameTime = 1000 / fps;
      
      // Adaptive quality based on performance
      if (fps < 20) {
        performanceRef.current.adaptiveQuality = Math.max(0.3, performanceRef.current.adaptiveQuality - 0.1);
      } else if (fps > 50) {
        performanceRef.current.adaptiveQuality = Math.min(1.0, performanceRef.current.adaptiveQuality + 0.05);
      }
      
      counter.frames = 0;
      counter.lastTime = timestamp;
    }
  }, []);

  // Optimized culling function
  const isCardVisible = useCallback((card: Card, viewWidth: number, viewHeight: number) => {
    const margin = Math.max(card.width, card.height);
    return card.x > -margin && 
           card.x < viewWidth + margin && 
           card.y > -margin && 
           card.y < viewHeight + margin;
  }, []);

  // Detect device capabilities with more comprehensive checks
  const detectDeviceCapabilities = useCallback(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    
    // Enhanced low-end device detection
    const lowEnd = mobile && (
      navigator.hardwareConcurrency === undefined || 
      navigator.hardwareConcurrency <= 4 ||
      // Check for reduced motion preference
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      // Check for low memory devices
      (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4
    );
    setIsLowEndDevice(lowEnd);
    
    return { mobile, lowEnd };
  }, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Use alpha: false for better performance if background is opaque
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      desynchronized: true, // Allow desynchronized rendering for better performance
      powerPreference: 'low-power' // Prefer power efficiency
    });
    if (!ctx) return;
    
    // Detect device capabilities
    const { mobile, lowEnd } = detectDeviceCapabilities();
    
    // Try to create OffscreenCanvas for better performance (if supported)
    let offscreenCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D = ctx;
    if (!mobile && 'OffscreenCanvas' in window) {
      try {
        const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
        const offCtx = offscreen.getContext('2d', { alpha: true });
        if (offCtx) {
          offscreenCanvasRef.current = offscreen;
          offscreenCtx = offCtx;
        }
      } catch (e) {
        console.log('OffscreenCanvas not supported, using regular canvas');
      }
    }
    
    // Set initial canvas dimensions with proper device pixel ratio handling
    const updateCanvasDimensions = () => {
      const pixelRatio = mobile ? 1 : Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      
      // Set canvas size with pixel ratio consideration
      canvas.width = displayWidth * pixelRatio;
      canvas.height = displayHeight * pixelRatio;
      
      // Update offscreen canvas if it exists
      if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current.width = canvas.width;
        offscreenCanvasRef.current.height = canvas.height;
      }
      
      // Scale the context to ensure correct drawing dimensions
      ctx.scale(pixelRatio, pixelRatio);
      if (offscreenCtx !== ctx) {
        (offscreenCtx as OffscreenCanvasRenderingContext2D).scale(pixelRatio, pixelRatio);
      }
      
      // Set CSS size
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };
    
    updateCanvasDimensions();
    
    // Throttled resize handler for better performance
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const { mobile: newMobile } = detectDeviceCapabilities();
        updateCanvasDimensions();
        initializeCards(newMobile);
      }, mobile ? 300 : 200);
    };
    
    // Object pooling for better memory management
    const cardPool: Card[] = [];
    const getCardFromPool = (): Card => {
      return cardPool.pop() || {
        x: 0, y: 0, width: 0, height: 0, rotation: 0, rotationSpeed: 0,
        opacity: 0, color: '', scale: 1, scaleDirection: 1, moveX: 0, moveY: 0,
        isVisible: true, lastUpdate: 0
      };
    };
    
    const returnCardToPool = (card: Card) => {
      cardPool.push(card);
    };
    
    // Initialize cards with proper positioning and object pooling
    const initializeCards = (isMobileDevice: boolean) => {
      // Return existing cards to pool
      cardsRef.current.forEach(card => returnCardToPool(card));
      cardsRef.current = [];
      
      // Adaptive card count based on performance and device
      const baseCardCount = lowEnd ? 2 : (isMobileDevice ? 4 : 8);
      const adaptiveCardCount = Math.floor(baseCardCount * performanceRef.current.adaptiveQuality);
      const cardCount = Math.max(1, Math.min(adaptiveCardCount, Math.floor(window.innerWidth / 200)));
      
      for (let i = 0; i < cardCount; i++) {
        const card = getCardFromPool();
        
        // Smaller cards on mobile
        const width = isMobileDevice ? (40 + Math.random() * 25) : (50 + Math.random() * 35);
        const height = width * 1.4; // Card aspect ratio
        
        // Slower movement and rotation on mobile
        const speedFactor = isMobileDevice ? 0.3 : 0.6;
        const rotationSpeed = (Math.random() - 0.5) * 0.08 * speedFactor;
        const moveSpeed = (Math.random() - 0.5) * 0.08 * speedFactor;
        
        Object.assign(card, {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          width,
          height,
          rotation: Math.random() * 360,
          rotationSpeed,
          opacity: isMobileDevice ? (0.008 + Math.random() * 0.015) : (0.015 + Math.random() * 0.025),
          color: getRandomColor(),
          scale: 0.8 + Math.random() * 0.4,
          scaleDirection: Math.random() > 0.5 ? 1 : -1,
          moveX: moveSpeed,
          moveY: moveSpeed,
          isVisible: true,
          lastUpdate: 0
        });
        
        cardsRef.current.push(card);
      }
    };
    
    // Pre-computed color array for better performance
    const colors = [
      '#3B82F6', '#2563EB', '#1E40AF', '#1D4ED8', '#0284C7'
    ];
    
    function getRandomColor() {
      return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Initialize cards
    initializeCards(mobile);
    
    // Animation variables
    let animationFrameId: number;
    let lastFrameTime = 0;
    
    // Dynamic FPS based on performance
    const getTargetFPS = () => {
      const baseFPS = lowEnd ? 20 : (mobile ? 30 : 60);
      return Math.max(15, Math.floor(baseFPS * performanceRef.current.adaptiveQuality));
    };
    
    // Visibility change detection
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    
    // Intersection Observer with lower threshold for mobile
    const observerThreshold = mobile ? 0.02 : 0.05;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: observerThreshold }
    );
    
    observer.observe(canvas);
    
    // Optimized animation loop with batched operations
    const render = (timestamp: number) => {
      if (!isVisible) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }
      
      // Update performance metrics
      updatePerformanceMetrics(timestamp);
      
      // Dynamic frame rate control
      const targetFPS = getTargetFPS();
      const frameInterval = 1000 / targetFPS;
      const elapsed = timestamp - lastFrameTime;
      
      if (elapsed < frameInterval) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }
      
      lastFrameTime = timestamp - (elapsed % frameInterval);
      frameCountRef.current++;
      
      // Use offscreen canvas if available
      const renderCtx = offscreenCtx;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      
      // Clear canvas with optimized method
      renderCtx.clearRect(0, 0, viewWidth, viewHeight);
      
      // Batch canvas state changes
      renderCtx.save();
      
      // Update positions less frequently on mobile
      const shouldUpdatePositions = !mobile || (frameCountRef.current % 2 === 0);
      const shouldUpdateScale = frameCountRef.current % (mobile ? 6 : 4) === 0;
      
      // Process cards with culling and batched operations
      const visibleCards = cardsRef.current.filter(card => {
        // Update card visibility
        card.isVisible = isCardVisible(card, viewWidth, viewHeight);
        return card.isVisible;
      });
      
      // Batch similar operations
      visibleCards.forEach(card => {
        if (shouldUpdatePositions) {
          // Update position and rotation
          card.rotation += card.rotationSpeed;
          card.x += card.moveX;
          card.y += card.moveY;
          
          // Efficient edge wrapping
          if (card.x < -card.width) card.x = viewWidth + card.width;
          else if (card.x > viewWidth + card.width) card.x = -card.width;
          if (card.y < -card.height) card.y = viewHeight + card.height;
          else if (card.y > viewHeight + card.height) card.y = -card.height;
          
          // Update scale less frequently
          if (shouldUpdateScale) {
            card.scale += 0.0001 * card.scaleDirection;
            if (card.scale > 1.15 || card.scale < 0.85) {
              card.scaleDirection *= -1;
            }
          }
        }
      });
      
      // Render visible cards with batched state changes
      visibleCards.forEach(card => {
        renderCtx.save();
        renderCtx.translate(card.x, card.y);
        renderCtx.rotate((card.rotation * Math.PI) / 180);
        renderCtx.scale(card.scale, card.scale);
        renderCtx.globalAlpha = card.opacity * performanceRef.current.adaptiveQuality;
        
        // Optimized drawing with reduced detail on low performance
        renderCtx.strokeStyle = card.color;
        renderCtx.lineWidth = mobile ? 0.4 : 0.8;
        renderCtx.beginPath();
        renderCtx.roundRect(-card.width / 2, -card.height / 2, card.width, card.height, 6);
        renderCtx.stroke();
        
        // Draw inner frame only on high performance or desktop
        if (performanceRef.current.adaptiveQuality > 0.7 && (!mobile || frameCountRef.current % 4 === 0)) {
          renderCtx.beginPath();
          renderCtx.roundRect(-card.width / 2 + 4, -card.height / 2 + 4, card.width - 8, card.height / 2 - 8, 3);
          renderCtx.stroke();
        }
        
        renderCtx.restore();
      });
      
      renderCtx.restore();
      
      // Copy from offscreen canvas if using it
      if (offscreenCanvasRef.current && renderCtx !== ctx) {
        ctx.clearRect(0, 0, viewWidth, viewHeight);
        ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
      
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
      
      // Return cards to pool for memory cleanup
      cardsRef.current.forEach(card => returnCardToPool(card));
      cardsRef.current = [];
    };
  }, [detectDeviceCapabilities, isVisible, updatePerformanceMetrics, isCardVisible]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 will-change-transform ${className || ''}`}
      style={{ 
        transform: 'translateZ(0)', // Force hardware acceleration
        imageRendering: isMobile ? 'optimizeSpeed' : 'auto' // Optimize rendering on mobile
      }}
      aria-hidden="true"
    />
  );
};

export default AnimatedBackground;