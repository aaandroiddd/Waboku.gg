import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  className?: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Check if we're on a mobile device
    const isMobile = window.innerWidth < 768;
    
    // Set canvas dimensions immediately to prevent layout shifts
    // This is important to avoid the page jumping after load
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Set canvas dimensions to match window size on resize
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    // Handle scroll events to ensure canvas covers the viewport
    const handleScroll = () => {
      if (canvas) {
        // Ensure the canvas height is at least the viewport height
        if (canvas.height < window.innerHeight) {
          canvas.height = window.innerHeight;
        }
      }
    };
    
    // Set initial size with a small delay to ensure the DOM is ready
    setTimeout(resizeCanvas, 10);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', handleScroll);
    
    // Card shapes
    const cards: Card[] = [];
    // Reduce card count on mobile for better performance
    const cardCount = isMobile 
      ? Math.min(6, Math.floor(window.innerWidth / 200)) 
      : Math.min(15, Math.floor(window.innerWidth / 150));
    
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
    
    // Create cards
    for (let i = 0; i < cardCount; i++) {
      const width = 60 + Math.random() * 40;
      const height = width * 1.4; // Card aspect ratio
      
      cards.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        width,
        height,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        opacity: 0.03 + Math.random() * 0.05,
        color: getRandomColor(),
        scale: 0.8 + Math.random() * 0.4,
        scaleDirection: Math.random() > 0.5 ? 1 : -1,
        moveX: (Math.random() - 0.5) * 0.2,
        moveY: (Math.random() - 0.5) * 0.2
      });
    }
    
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
    
    // Animation loop
    let animationFrameId: number;
    
    const render = () => {
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
        
        // Subtle scale animation
        card.scale += 0.0005 * card.scaleDirection;
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
        
        // Card inner frame
        ctx.beginPath();
        ctx.roundRect(-card.width / 2 + 5, -card.height / 2 + 5, card.width - 10, card.height / 2 - 10, 4);
        ctx.stroke();
        
        ctx.restore();
      });
      
      animationFrameId = window.requestAnimationFrame(render);
    };
    
    render();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 ${className || ''}`}
    />
  );
};

export default AnimatedBackground;