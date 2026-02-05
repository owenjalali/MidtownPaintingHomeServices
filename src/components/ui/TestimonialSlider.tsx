import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

export interface Testimonial {
    name: string;
    location: string;
    rating: number;
    text: string;
    project: string;
}

interface TestimonialSliderProps {
    testimonials: Testimonial[];
    autoPlayInterval?: number;
}

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? 300 : -300,
        opacity: 0,
    }),
};

const TestimonialSlider: React.FC<TestimonialSliderProps> = ({
    testimonials,
    autoPlayInterval = 5000,
}) => {
    const [[page, direction], setPage] = useState([0, 0]);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const testimonialIndex = ((page % testimonials.length) + testimonials.length) % testimonials.length;

    const paginate = useCallback(
        (newDirection: number) => {
            setPage(([prevPage]) => [prevPage + newDirection, newDirection]);
        },
        []
    );

    useEffect(() => {
        if (!isAutoPlaying) return;
        const interval = setInterval(() => {
            paginate(1);
        }, autoPlayInterval);
        return () => clearInterval(interval);
    }, [isAutoPlaying, autoPlayInterval, paginate]);

    const handleManualNav = (newDirection: number) => {
        setIsAutoPlaying(false);
        paginate(newDirection);
        // Resume autoplay after 8 seconds of inactivity
        setTimeout(() => setIsAutoPlaying(true), 8000);
    };

    const goToSlide = (index: number) => {
        setIsAutoPlaying(false);
        const diff = index - testimonialIndex;
        setPage(([prevPage]) => [prevPage + diff, diff > 0 ? 1 : -1]);
        setTimeout(() => setIsAutoPlaying(true), 8000);
    };

    const current = testimonials[testimonialIndex];

    return (
        <div className="relative w-full max-w-4xl mx-auto">
            {/* Card */}
            <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 min-h-[280px] md:min-h-[240px]">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                        key={page}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: 'spring', stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                        }}
                        className="flex flex-col md:flex-row items-center gap-6 md:gap-10 p-8 md:p-10"
                    >
                        {/* Avatar */}
                        <div className="shrink-0">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-midtown-orange flex items-center justify-center text-white font-heading font-bold text-3xl md:text-4xl shadow-lg">
                                {current.name.charAt(0)}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 text-center md:text-left">
                            {/* Stars */}
                            <div className="flex items-center justify-center md:justify-start gap-1 mb-4">
                                {[...Array(current.rating)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className="w-5 h-5 text-midtown-orange fill-midtown-orange"
                                    />
                                ))}
                            </div>

                            {/* Quote */}
                            <p className="text-white/90 text-base md:text-lg leading-relaxed italic mb-5">
                                "{current.text}"
                            </p>

                            {/* Author */}
                            <div>
                                <div className="font-heading font-bold text-white text-base">
                                    {current.name}
                                </div>
                                <div className="text-midtown-blue text-sm">
                                    {current.location} · {current.project}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Arrows */}
            <button
                onClick={() => handleManualNav(-1)}
                className="absolute left-2 md:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Previous testimonial"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <button
                onClick={() => handleManualNav(1)}
                className="absolute right-2 md:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Next testimonial"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex items-center justify-center gap-2 mt-6">
                {testimonials.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                            index === testimonialIndex
                                ? 'bg-midtown-orange w-8'
                                : 'bg-white/30 hover:bg-white/50'
                        }`}
                        aria-label={`Go to testimonial ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default TestimonialSlider;
