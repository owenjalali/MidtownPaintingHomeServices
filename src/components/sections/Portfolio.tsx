import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const portfolioImages = [
    { src: '/images/gallery-1.png', alt: 'Deck & Railing' },
    { src: '/images/gallery-2.png', alt: 'Interior Design' },
    { src: '/images/gallery-3.png', alt: 'Garage Refresh' },
    { src: '/images/gallery-4.png', alt: 'Porch Restoration' },
    { src: '/images/gallery-5.png', alt: 'Front Porch Painting' },
    { src: '/images/gallery-6.png', alt: 'Home Exterior' },
    { src: '/images/project-exterior.png', alt: 'Exterior Transformation' },
    { src: '/images/project-deck-staining.png', alt: 'Deck Staining' },
    { src: '/images/project-fence-deck.png', alt: 'Fence & Deck' },
    { src: '/images/finished-deck.png', alt: 'Finished Deck' },
];

const Portfolio: React.FC = () => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const openImage = (index: number) => setSelectedIndex(index);
    const closeImage = () => setSelectedIndex(null);

    const goToNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % portfolioImages.length);
        }
    };

    const goToPrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + portfolioImages.length) % portfolioImages.length);
        }
    };

    // Keyboard navigation
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return;
            if (e.key === 'Escape') closeImage();
            if (e.key === 'ArrowRight') setSelectedIndex((selectedIndex + 1) % portfolioImages.length);
            if (e.key === 'ArrowLeft') setSelectedIndex((selectedIndex - 1 + portfolioImages.length) % portfolioImages.length);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex]);

    const getFlexValue = (index: number) => {
        if (hoveredIndex === null) return 1;
        return hoveredIndex === index ? 2.5 : 0.6;
    };

    return (
        <section id="portfolio" className="py-24 lg:py-32 bg-white">
            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-2xl mx-auto mb-16"
                >
                    <span className="text-midtown-orange font-semibold text-sm uppercase tracking-[0.2em]">
                        Portfolio
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-4">
                        Our Latest Work
                    </h2>
                    <p className="text-gray-500 text-lg">
                        Click any image to view it full-size.
                    </p>
                </motion.div>

                {/* Expandable Gallery — Desktop */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="hidden md:flex items-center gap-2 h-[420px] max-w-6xl mx-auto"
                >
                    {portfolioImages.map((img, index) => (
                        <motion.div
                            key={index}
                            className="relative cursor-pointer overflow-hidden rounded-xl h-full"
                            style={{ flex: 1 }}
                            animate={{ flex: getFlexValue(index) }}
                            transition={{ duration: 0.5, ease: 'easeInOut' }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => openImage(index)}
                        >
                            <img
                                src={img.src}
                                alt={img.alt}
                                className="w-full h-full object-cover"
                                draggable={false}
                            />
                            {/* Darken non-hovered images */}
                            <motion.div
                                className="absolute inset-0 bg-midtown-dark"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.4 : 0 }}
                                transition={{ duration: 0.3 }}
                            />
                            {/* Title on hover */}
                            <motion.div
                                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-midtown-dark/80 to-transparent"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <p className="text-white font-heading font-semibold text-sm">{img.alt}</p>
                            </motion.div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Grid Gallery — Mobile */}
                <div className="grid grid-cols-2 gap-3 md:hidden">
                    {portfolioImages.map((img, index) => (
                        <div
                            key={index}
                            className="relative overflow-hidden rounded-xl cursor-pointer h-44"
                            onClick={() => openImage(index)}
                        >
                            <img
                                src={img.src}
                                alt={img.alt}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="text-center mt-16"
                >
                    <a
                        href="#contact"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-midtown-navy text-white rounded-full font-semibold hover:bg-midtown-navy/90 transition-all shadow-lg"
                    >
                        Get Your Free Quote
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </a>
                </motion.div>
            </div>

            {/* Lightbox Modal */}
            <AnimatePresence>
                {selectedIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                        onClick={closeImage}
                    >
                        {/* Close button */}
                        <button
                            className="absolute top-6 right-6 z-10 text-white/80 hover:text-white transition-colors"
                            onClick={closeImage}
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Previous button */}
                        <button
                            className="absolute left-4 md:left-8 z-10 text-white/60 hover:text-white transition-colors"
                            onClick={goToPrev}
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        {/* Image */}
                        <motion.div
                            className="relative flex items-center justify-center"
                            style={{ maxWidth: '90vw', maxHeight: '85vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <motion.img
                                key={selectedIndex}
                                src={portfolioImages[selectedIndex].src}
                                alt={portfolioImages[selectedIndex].alt}
                                className="rounded-lg shadow-2xl"
                                style={{
                                    maxWidth: '90vw',
                                    maxHeight: '85vh',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                }}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.3 }}
                            />
                        </motion.div>

                        {/* Next button */}
                        <button
                            className="absolute right-4 md:right-8 z-10 text-white/60 hover:text-white transition-colors"
                            onClick={goToNext}
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* Counter */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
                            {selectedIndex + 1} / {portfolioImages.length}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};

export default Portfolio;
