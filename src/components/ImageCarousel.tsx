"use client";

import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface ImageCarouselProps {
  images: string[];
}

export default function ImageCarousel({ images }: ImageCarouselProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);

  // Configure slider with drag mode for mobile
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
    slides: {
      perView: 1,
      spacing: 10,
    },
    dragSpeed: 1.5,
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
    created() {
      setCurrentSlide(0);
    },
  });

  const openModal = (index: number) => {
    setCurrentSlide(index);
    setIsModalOpen(true);
    setZoom(1);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setZoom(1);
    setIsDragging(false);
    setPinchDistance(null);
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 1));

  // Touch event handlers for mobile pinch zoom and swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - prepare for swipe
      setIsDragging(true);
      setStartX(e.touches[0].clientX);
      setStartY(e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      // Two touches - prepare for pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchDistance(distance);
      setInitialZoom(zoom);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDistance !== null) {
      // Handle pinch zoom
      e.preventDefault(); // Prevent default to avoid page scrolling
      const newDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = newDistance / pinchDistance;
      const newZoom = Math.max(1, Math.min(3, initialZoom * scale));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isDragging && e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Only handle horizontal swipes if they're significant and more horizontal than vertical
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe right - go to previous slide
          setCurrentSlide((prev) => (prev - 1 + images.length) % images.length);
        } else {
          // Swipe left - go to next slide
          setCurrentSlide((prev) => (prev + 1) % images.length);
        }
      }
    }
    
    setIsDragging(false);
    setPinchDistance(null);
  };

  return (
    <>
      {/* Main container with proper spacing for arrows */}
      <div className={`relative w-full ${isMobile ? 'max-w-md' : 'max-w-2xl'} mx-auto`}>
        {/* Carousel container with margin for arrows */}
        <div className={`relative w-full ${!isMobile ? 'mx-12' : ''} max-w-md mx-auto`}>
          {/* Navigation arrows - positioned differently for mobile vs desktop */}
          {isMobile ? (
            // Mobile arrows - positioned inside the carousel area, no hover effects
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/60 active:bg-black/80 p-3 rounded-full shadow-lg border border-white/30 touch-manipulation"
                onClick={() => instanceRef.current?.prev()}
                aria-label="Previous image"
                style={{ pointerEvents: 'auto' }}
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/60 active:bg-black/80 p-3 rounded-full shadow-lg border border-white/30 touch-manipulation"
                onClick={() => instanceRef.current?.next()}
                aria-label="Next image"
                style={{ pointerEvents: 'auto' }}
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            </>
          ) : (
            // Desktop arrows - positioned outside the carousel
            <>
              <button
                className="absolute -left-12 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border border-gray-200 dark:bg-gray-800/90 dark:hover:bg-gray-800 dark:border-gray-600"
                onClick={() => instanceRef.current?.prev()}
                aria-label="Previous image"
                style={{ pointerEvents: 'auto' }}
              >
                <ChevronLeft className="h-5 w-5 dark:text-white" />
              </button>
              <button
                className="absolute -right-12 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border border-gray-200 dark:bg-gray-800/90 dark:hover:bg-gray-800 dark:border-gray-600"
                onClick={() => instanceRef.current?.next()}
                aria-label="Next image"
                style={{ pointerEvents: 'auto' }}
              >
                <ChevronRight className="h-5 w-5 dark:text-white" />
              </button>
            </>
          )}
          {/* Carousel */}
          <div 
            ref={sliderRef} 
            className="keen-slider rounded-2xl overflow-hidden touch-manipulation"
          >
            {images.map((src, idx) => (
              <motion.div
                key={idx}
                className="keen-slider__slide flex items-center justify-center bg-gray-100 dark:bg-gray-800 relative"
                onClick={() => openModal(idx)}
              >
                <img
                  src={src}
                  alt={`Image ${idx + 1}`}
                  className="object-contain w-full h-64 md:h-80 cursor-pointer"
                  loading="lazy"
                />
                {/* Mobile swipe indicator - only show if there are multiple images */}
                {isMobile && images.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/30 px-2 py-1 rounded">
                    Swipe to view more images
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Dots - larger on mobile for better touch targets */}
          <div className="flex justify-center mt-4 gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => instanceRef.current?.moveToSlide(idx)}
                className={`${isMobile ? 'h-3 w-3' : 'h-2 w-2'} rounded-full ${
                  currentSlide === idx ? "bg-black dark:bg-white" : "bg-gray-300 dark:bg-gray-700"
                }`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4"
          >
            {/* Close Button - larger on mobile */}
            <button
              onClick={closeModal}
              className={`absolute top-4 right-4 bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full`}
              aria-label="Close fullscreen view"
            >
              <X className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
            </button>

            {/* Zoom Controls - conditionally shown based on device */}
            <div className={`absolute bottom-8 flex gap-4 ${isMobile ? 'opacity-50' : ''}`}>
              <button
                onClick={zoomOut}
                className={`bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full`}
                aria-label="Zoom out"
              >
                <ZoomOut className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
              </button>
              <button
                onClick={zoomIn}
                className={`bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full`}
                aria-label="Zoom in"
              >
                <ZoomIn className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
              </button>
            </div>

            {/* Image Viewer with touch events for mobile */}
            <div 
              className="relative w-full max-w-3xl h-full flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={images[currentSlide]}
                alt={`Image ${currentSlide + 1}`}
                className="object-contain max-h-full max-w-full touch-none"
                style={{ transform: `scale(${zoom})` }}
                draggable="false"
              />

              {/* Left/Right Arrows inside Modal - visible on all devices */}
              <button
                className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full transition-all duration-200 hover:scale-110`}
                onClick={() => setCurrentSlide((prev) => (prev - 1 + images.length) % images.length)}
                aria-label="Previous image"
              >
                <ChevronLeft className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
              </button>
              <button
                className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full transition-all duration-200 hover:scale-110`}
                onClick={() => setCurrentSlide((prev) => (prev + 1) % images.length)}
                aria-label="Next image"
              >
                <ChevronRight className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
              </button>
              
              {/* Mobile indicator text */}
              {isMobile && (
                <div className="absolute bottom-20 text-white/70 text-sm">
                  <p>Swipe to navigate • Pinch to zoom</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}