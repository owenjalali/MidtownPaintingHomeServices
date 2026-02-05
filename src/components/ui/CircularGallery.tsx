
import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface GalleryItem {
    id: string;
    src: string;
    title?: string;
}

interface CircularGalleryProps {
    items: GalleryItem[];
    className?: string;
}

const CircularGallery: React.FC<CircularGalleryProps> = ({ items, className = '' }) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const radius = 180; // Radius of the circle
    const cardWidth = 80;
    const totalItems = items.length;

    const getPosition = (index: number, hovered: number | null) => {
        // Distribute items in a semicircle (bottom half)
        const baseAngle = Math.PI + (index / (totalItems - 1)) * Math.PI;

        // Add subtle shift when hovering nearby items
        let angleOffset = 0;
        if (hovered !== null && hovered !== index) {
            const distance = Math.abs(hovered - index);
            if (distance <= 2) {
                angleOffset = (hovered > index ? -0.03 : 0.03) * (3 - distance);
            }
        }

        const angle = baseAngle + angleOffset;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const rotation = ((angle * 180) / Math.PI) - 90;

        return { x, y, rotation };
    };

    return (
        <div className={`relative ${className}`} style={{ height: radius + cardWidth + 60 }}>
            {/* Center title */}
            <motion.h3
                className="absolute top-8 left-1/2 -translate-x-1/2 text-2xl font-heading font-bold text-midtown-navy z-10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
            >
                Our Work
            </motion.h3>

            {/* Circular arrangement */}
            <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: -radius + 80 }}
            >
                {items.map((item, index) => {
                    const { x, y, rotation } = getPosition(index, hoveredIndex);
                    const isActive = activeId === item.id;

                    return (
                        <motion.div
                            key={item.id}
                            className="absolute cursor-pointer"
                            style={{
                                width: cardWidth,
                                aspectRatio: '4/6',
                                left: radius - cardWidth / 2,
                                top: radius,
                            }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                                x,
                                y,
                                rotate: rotation,
                                opacity: 1,
                                scale: 1,
                                zIndex: isActive ? 50 : hoveredIndex === index ? 30 : 10,
                            }}
                            transition={{
                                type: 'spring',
                                stiffness: 200,
                                damping: 25,
                                delay: index * 0.05,
                            }}
                            whileHover={{ scale: 1.15, zIndex: 30 }}
                            onHoverStart={() => setHoveredIndex(index)}
                            onHoverEnd={() => setHoveredIndex(null)}
                            onClick={() => setActiveId(isActive ? null : item.id)}
                        >
                            <div className="w-full h-full rounded-lg overflow-hidden shadow-lg border-2 border-white">
                                <img
                                    src={item.src}
                                    alt={item.title || `Work ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Title tooltip */}
                            {item.title && hoveredIndex === index && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-midtown-navy text-white text-xs px-2 py-1 rounded"
                                    style={{ rotate: -rotation }}
                                >
                                    {item.title}
                                </motion.div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Active item large preview */}
            {activeId && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setActiveId(null)}
                >
                    <motion.img
                        src={items.find(i => i.id === activeId)?.src}
                        alt="Preview"
                        className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl"
                        layoutId={`gallery-${activeId}`}
                    />
                </motion.div>
            )}
        </div>
    );
};

export default CircularGallery;
