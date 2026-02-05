import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ImageComparisonSliderProps {
    beforeImage: string;
    afterImage: string;
    beforeAlt?: string;
    afterAlt?: string;
    className?: string;
    initialPosition?: number;
}

const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({
    beforeImage,
    afterImage,
    beforeAlt = 'Before',
    afterAlt = 'After',
    className = '',
    initialPosition = 50,
}) => {
    const [sliderPosition, setSliderPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const updateSliderPosition = useCallback((clientX: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
        setSliderPosition(percentage);
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        updateSliderPosition(e.clientX);
    }, [updateSliderPosition]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        setIsDragging(true);
        updateSliderPosition(e.touches[0].clientX);
    }, [updateSliderPosition]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            updateSliderPosition(e.clientX);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            updateSliderPosition(e.touches[0].clientX);
        };

        const handleEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, updateSliderPosition]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize select-none",
                className
            )}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            {/* After Image (Background) */}
            <img
                src={afterImage}
                alt={afterAlt}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
            />

            {/* Before Image (Clipped) */}
            <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
                <img
                    src={beforeImage}
                    alt={beforeAlt}
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                />
            </div>

            {/* Slider Handle */}
            <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
            >
                {/* Handle Circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-midtown-orange">
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-midtown-navy rotate-180" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        <svg className="w-4 h-4 text-midtown-navy" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            </div>


            {/* Instructions overlay */}
            <motion.div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full"
                initial={{ opacity: 1 }}
                animate={{ opacity: isDragging ? 0 : 1 }}
                transition={{ duration: 0.3 }}
            >
                ← Drag to compare →
            </motion.div>
        </div>
    );
};

export default ImageComparisonSlider;
