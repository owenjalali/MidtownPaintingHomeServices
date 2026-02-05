import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface Testimonial {
    id: string;
    name: string;
    role?: string;
    image?: string;
    content: string;
    rating: number;
}

interface AnimatedCardsStackProps {
    testimonials: Testimonial[];
    className?: string;
}

export const ReviewStars: React.FC<{ rating: number }> = ({ rating }) => {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    className={cn(
                        "w-5 h-5",
                        i <= rating ? "fill-midtown-orange text-midtown-orange" : "text-gray-300"
                    )}
                />
            ))}
        </div>
    );
};

export const AnimatedCardsStack: React.FC<AnimatedCardsStackProps> = ({
    testimonials,
    className
}) => {
    const [cards, setCards] = useState(testimonials);
    const [exitDirection, setExitDirection] = useState<'left' | 'right'>('right');

    const removeCard = (id: string, direction: 'left' | 'right') => {
        setExitDirection(direction);
        const removedCard = cards.find(card => card.id === id);
        setCards(prev => prev.filter(card => card.id !== id));

        // Add card back to the end after animation
        setTimeout(() => {
            if (removedCard) {
                setCards(prev => [...prev, removedCard]);
            }
        }, 500);
    };

    return (
        <div className={cn("relative h-[400px] w-full max-w-lg mx-auto", className)}>
            <AnimatePresence>
                {cards.slice(0, 3).map((card, index) => (
                    <TestimonialCard
                        key={card.id}
                        testimonial={card}
                        index={index}
                        totalCards={Math.min(cards.length, 3)}
                        onRemove={(direction) => removeCard(card.id, direction)}
                        exitDirection={exitDirection}
                    />
                ))}
            </AnimatePresence>

            {/* Instructions */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-gray-500">
                Swipe or drag cards to see more
            </div>
        </div>
    );
};

interface TestimonialCardProps {
    testimonial: Testimonial;
    index: number;
    totalCards: number;
    onRemove: (direction: 'left' | 'right') => void;
    exitDirection: 'left' | 'right';
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
    testimonial,
    index,
    totalCards,
    onRemove,
    exitDirection,
}) => {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    const handleDragEnd = (_: any, info: any) => {
        if (Math.abs(info.offset.x) > 100) {
            onRemove(info.offset.x > 0 ? 'right' : 'left');
        }
    };

    const cardVariants = {
        initial: {
            scale: 1 - (index * 0.05),
            y: index * 15,
            zIndex: totalCards - index,
        },
        animate: {
            scale: 1 - (index * 0.05),
            y: index * 15,
            zIndex: totalCards - index,
            transition: { duration: 0.3 }
        },
        exit: {
            x: exitDirection === 'right' ? 300 : -300,
            opacity: 0,
            transition: { duration: 0.3 }
        }
    };

    return (
        <motion.div
            className={cn(
                "absolute inset-x-0 top-0 bg-white rounded-2xl shadow-xl p-8",
                "border border-gray-100 cursor-grab active:cursor-grabbing",
                index === 0 ? "pointer-events-auto" : "pointer-events-none"
            )}
            style={{ x, rotate, opacity: index === 0 ? opacity : 1 - (index * 0.15) }}
            variants={cardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            drag={index === 0 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            whileHover={index === 0 ? { scale: 1.02 } : {}}
        >
            {/* Rating */}
            <ReviewStars rating={testimonial.rating} />

            {/* Content */}
            <p className="text-gray-700 text-lg leading-relaxed mt-4 mb-6">
                "{testimonial.content}"
            </p>

            {/* Author */}
            <div className="flex items-center gap-4">
                {testimonial.image ? (
                    <img
                        src={testimonial.image}
                        alt={testimonial.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-midtown-orange"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-midtown-navy flex items-center justify-center text-white font-bold text-lg">
                        {testimonial.name.charAt(0)}
                    </div>
                )}
                <div>
                    <h4 className="font-heading font-bold text-midtown-navy">
                        {testimonial.name}
                    </h4>
                    {testimonial.role && (
                        <p className="text-sm text-gray-500">{testimonial.role}</p>
                    )}
                </div>
            </div>

            {/* Decorative quote marks */}
            <div className="absolute top-4 right-6 text-6xl text-midtown-blue/20 font-serif">
                "
            </div>
        </motion.div>
    );
};

export default AnimatedCardsStack;
