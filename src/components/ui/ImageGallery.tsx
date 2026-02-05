import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ImageGalleryItem {
    id: string;
    beforeImage: string;
    afterImage: string;
    title: string;
    description?: string;
}

interface ImageGalleryProps {
    items: ImageGalleryItem[];
    className?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ items, className }) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <>
            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
                {items.map((item, index) => (
                    <motion.div
                        key={item.id}
                        layoutId={item.id}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg"
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => setSelectedId(item.id)}
                    >
                        {/* Before Image */}
                        <motion.img
                            src={item.beforeImage}
                            alt={`${item.title} - Before`}
                            className="w-full h-64 object-cover"
                            animate={{
                                opacity: hoveredId === item.id ? 0 : 1,
                            }}
                            transition={{ duration: 0.5 }}
                        />

                        {/* After Image (shows on hover) */}
                        <motion.img
                            src={item.afterImage}
                            alt={`${item.title} - After`}
                            className="absolute inset-0 w-full h-64 object-cover"
                            initial={{ opacity: 0 }}
                            animate={{
                                opacity: hoveredId === item.id ? 1 : 0,
                            }}
                            transition={{ duration: 0.5 }}
                        />

                        {/* Labels */}
                        <div className="absolute top-4 left-4 flex gap-2 z-10">
                            <motion.span
                                className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full"
                                animate={{
                                    backgroundColor: hoveredId === item.id ? 'rgba(37, 99, 235, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                                    color: 'white',
                                }}
                                transition={{ duration: 0.3 }}
                            >
                                {hoveredId === item.id ? 'After' : 'Before'}
                            </motion.span>
                        </div>

                        {/* Overlay with title */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                            <h3 className="text-white font-heading font-bold text-lg">{item.title}</h3>
                            {item.description && (
                                <p className="text-white/80 text-sm mt-1">{item.description}</p>
                            )}
                        </div>

                        {/* Hover instruction */}
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center bg-black/20"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: hoveredId === item.id ? 0 : 0.5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <span className="text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-full">
                                Hover to reveal
                            </span>
                        </motion.div>
                    </motion.div>
                ))}
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {selectedId && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedId(null)}
                    >
                        <motion.div
                            layoutId={selectedId}
                            className="relative max-w-4xl max-h-[90vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {items.filter(i => i.id === selectedId).map(item => (
                                <div key={item.id} className="relative">
                                    <div className="relative overflow-hidden rounded-2xl">
                                        <motion.img
                                            src={item.afterImage}
                                            alt={item.title}
                                            className="w-full h-auto"
                                        />
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 rounded-b-2xl">
                                        <h3 className="text-white font-heading font-bold text-2xl">{item.title}</h3>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setSelectedId(null)}
                                className="absolute -top-12 right-0 text-white text-lg hover:text-midtown-orange transition-colors"
                            >
                                ✕ Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ImageGallery;
