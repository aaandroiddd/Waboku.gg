"use client";

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
  const [modalSlide, setModalSlide] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isModalOpen) {
      // Handle modal swipes
      if (isLeftSwipe && modalSlide < images.length - 1) {
        setModalSlide(modalSlide + 1);
      }
      if (isRightSwipe && modalSlide > 0) {
        setModalSlide(modalSlide - 1);
      }
    } else {
      // Handle main carousel swipes
      if (isLeftSwipe && currentSlide < images.length - 1) {
        setCurrentSlide(currentSlide + 1);
      }
      if (isRightSwipe && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const openModal = (index?: number) => {
    const slideIndex = index !== undefined ? index : currentSlide;
    setModalSlide(slideIndex);
    setIsModalOpen(true);
    setZoom(1);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setZoom(1);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + images.length) % images.length);
  };

  const nextModalSlide = () => {
    setModalSlide((prev) => (prev + 1) % images.length);
  };

  const prevModalSlide = () => {
    setModalSlide((prev) => (prev - 1 + images.length) % images.length);
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 1));

  return (
    <>
      {/* Main Carousel Container */}
      <div className={`relative w-full ${isMobile ? 'max-w-md' : 'max-w-2xl'} mx-auto`}>
        {/* Main Image Display */}
        <div className="relative">
          {/* Desktop Navigation Arrows */}
          {!isMobile && images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border border-gray-200 dark:bg-gray-800/90 dark:hover:bg-gray-800 dark:border-gray-600"
                onClick={prevSlide}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 dark:text-white" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border border-gray-200 dark:bg-gray-800/90 dark:hover:bg-gray-800 dark:border-gray-600"
                onClick={nextSlide}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5 dark:text-white" />
              </button>
            </>
          )}

          {/* Main Image */}
          <div 
            className="relative bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => openModal(currentSlide)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <motion.img
              key={currentSlide}
              src={images[currentSlide]}
              alt={`Image ${currentSlide + 1}`}
              className="w-full h-64 md:h-80 object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              loading="lazy"
            />
            
            {/* Mobile swipe indicator */}
            {isMobile && images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/30 px-2 py-1 rounded">
                Swipe to view more images
              </div>
            )}

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
                {currentSlide + 1} of {images.length}
              </div>
            )}
          </div>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className={`flex mt-4 gap-2 overflow-x-auto pb-2 ${
            isMobile ? 'justify-start' : 'justify-center'
          }`}>
            {images.map((src, idx) => (
              <button
                key={idx}
                onClick={() => isMobile ? openModal(idx) : goToSlide(idx)}
                className={`flex-shrink-0 ${
                  isMobile ? 'w-16 h-16' : 'w-20 h-20'
                } rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                  currentSlide === idx 
                    ? "border-blue-500 ring-2 ring-blue-500/30" 
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
                aria-label={`${isMobile ? 'View' : 'Go to'} image ${idx + 1}`}
              >
                <img
                  src={src}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* Single image indicator */}
        {images.length === 1 && (
          <div className="flex justify-center mt-4">
            <div className={`${isMobile ? 'h-3 w-3' : 'h-2 w-2'} rounded-full bg-black dark:bg-white`} />
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              className={`absolute top-4 right-4 bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full z-60`}
              aria-label="Close fullscreen view"
            >
              <X className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
            </button>

            {/* Image counter in modal */}
            <div className="absolute top-4 left-4 bg-black/50 text-white text-sm px-3 py-1 rounded">
              {modalSlide + 1} of {images.length}
            </div>

            {/* Zoom Controls */}
            <div className={`absolute bottom-8 flex gap-4 z-60 ${isMobile ? 'opacity-70' : ''}`}>
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

            {/* Modal Image Container */}
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
              <motion.img
                key={modalSlide}
                src={images[modalSlide]}
                alt={`Image ${modalSlide + 1}`}
                className="object-contain max-h-full max-w-full touch-none select-none"
                style={{ transform: `scale(${zoom})` }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                draggable="false"
              />

              {/* Modal Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full transition-all duration-200 hover:scale-110 z-60`}
                    onClick={prevModalSlide}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
                  </button>
                  <button
                    className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 ${isMobile ? 'p-3' : 'p-2'} rounded-full transition-all duration-200 hover:scale-110 z-60`}
                    onClick={nextModalSlide}
                    aria-label="Next image"
                  >
                    <ChevronRight className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} text-white`} />
                  </button>
                </>
              )}

              {/* Mobile instructions */}
              {isMobile && (
                <div className="absolute bottom-20 text-white/70 text-sm text-center">
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