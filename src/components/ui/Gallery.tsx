import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface GalleryImage {
    id: string;
    src: string;
    alt: string;
    title?: string;
}

interface GalleryProps {
    images: GalleryImage[];
    className?: string;
    title?: string;
    description?: string;
}

export const Gallery: React.FC<GalleryProps> = ({
    images,
    className,
    title,
    description
}) => {
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

    return (
        <>
            <div className={cn("w-full", className)}>
                {/* Header */}
                {(title || description) && (
                    <div className="text-center mb-12">
                        {title && (
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mb-4">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                                {description}
                            </p>
                        )}
                    </div>
                )}

                {/* Masonry Grid */}
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                    {images.map((image, index) => (
                        <motion.div
                            key={image.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="break-inside-avoid"
                        >
                            <motion.div
                                className="relative group cursor-pointer overflow-hidden rounded-xl"
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setSelectedImage(image)}
                            >
                                <img
                                    src={image.src}
                                    alt={image.alt}
                                    className="w-full h-auto object-cover"
                                    loading="lazy"
                                />

                                {/* Hover Overlay */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                >
                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                        {image.title && (
                                            <h3 className="text-white font-heading font-semibold text-lg">
                                                {image.title}
                                            </h3>
                                        )}
                                    </div>
                                </motion.div>

                                {/* Expand Icon */}
                                <motion.div
                                    className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg"
                                >
                                    <svg className="w-5 h-5 text-midtown-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImage(null)}
                    >
                        <motion.div
                            className="relative max-w-5xl max-h-[90vh] w-full"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                            />

                            {selectedImage.title && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 rounded-b-lg">
                                    <h3 className="text-white font-heading font-bold text-xl">
                                        {selectedImage.title}
                                    </h3>
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedImage(null)}
                                className="absolute -top-12 right-0 text-white hover:text-midtown-orange transition-colors flex items-center gap-2"
                            >
                                <X className="w-6 h-6" />
                                <span>Close</span>
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Gallery;
