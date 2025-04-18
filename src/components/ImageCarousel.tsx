"use client";

import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";
import { useState } from "react";

interface ImageCarouselProps {
  images: string[];
}

export default function ImageCarousel({ images }: ImageCarouselProps) {
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
  });
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const openModal = (index: number) => {
    setCurrentSlide(index);
    setIsModalOpen(true);
    setZoom(1);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setZoom(1);
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 1));

  return (
    <>
      <div className="relative w-full max-w-md mx-auto">
        {/* Arrows */}
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white p-2 rounded-full shadow"
          onClick={() => instanceRef.current?.prev()}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white p-2 rounded-full shadow"
          onClick={() => instanceRef.current?.next()}
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Carousel */}
        <div ref={sliderRef} className="keen-slider rounded-2xl overflow-hidden">
          {images.map((src, idx) => (
            <motion.div
              key={idx}
              className="keen-slider__slide flex items-center justify-center bg-gray-100"
              onClick={() => openModal(idx)}
            >
              <img
                src={src}
                alt={`Image ${idx + 1}`}
                className="object-contain w-full h-64 cursor-pointer"
              />
            </motion.div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex justify-center mt-4 gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => instanceRef.current?.moveToSlide(idx)}
              className={`h-2 w-2 rounded-full ${
                currentSlide === idx ? "bg-black dark:bg-white" : "bg-gray-300 dark:bg-gray-700"
              }`}
            />
          ))}
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
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Zoom Controls */}
            <div className="absolute bottom-8 flex gap-4">
              <button
                onClick={zoomOut}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full"
              >
                <ZoomOut className="h-6 w-6 text-white" />
              </button>
              <button
                onClick={zoomIn}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full"
              >
                <ZoomIn className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Image Viewer */}
            <div className="relative w-full max-w-3xl h-full flex items-center justify-center">
              <img
                src={images[currentSlide]}
                alt={`Image ${currentSlide + 1}`}
                className="object-contain max-h-full max-w-full"
                style={{ transform: `scale(${zoom})` }}
              />

              {/* Left/Right Arrows inside Modal */}
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 p-2 rounded-full"
                onClick={() => setCurrentSlide((prev) => (prev - 1 + images.length) % images.length)}
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 p-2 rounded-full"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % images.length)}
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}