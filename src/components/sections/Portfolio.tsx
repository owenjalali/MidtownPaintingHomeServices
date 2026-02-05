import React from 'react';
import { motion } from 'framer-motion';

const portfolioImages = [
    { src: '/images/gallery-1.png', alt: 'Exterior Transformation' },
    { src: '/images/gallery-2.png', alt: 'Garage Refresh' },
    { src: '/images/gallery-3.png', alt: 'Fence Restoration' },
    { src: '/images/gallery-4.png', alt: 'Deck Cleaning' },
    { src: '/images/gallery-5.png', alt: 'Home Exterior' },
    { src: '/images/gallery-6.png', alt: 'Porch Revival' },
];

const Portfolio: React.FC = () => {
    return (
        <section id="portfolio" className="relative py-20 lg:py-32 overflow-hidden">
            {/* Watercolor SVG filter background */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <filter id="watercolor-portfolio">
                    <feTurbulence type="fractalNoise" baseFrequency="0.01 0.03" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="100" />
                </filter>
            </svg>

            <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="splotch splotch-1"></div>
                <div className="splotch splotch-2"></div>
                <div className="splotch splotch-3"></div>
            </div>

            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-12"
                >
                    <span className="text-midtown-orange font-semibold text-sm uppercase tracking-wider">
                        Portfolio
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-6">
                        Our Latest Creations
                    </h2>
                    <p className="text-gray-600 text-lg">
                        A visual collection of our most recent works – each project completed
                        with precision, care, and craftsmanship.
                    </p>
                </motion.div>

                {/* Gallery - Grid on mobile, hover-expand on desktop */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-2 md:h-[500px] w-full max-w-6xl mx-auto"
                >
                    {portfolioImages.map((img, idx) => (
                        <div
                            key={idx}
                            className="relative group overflow-hidden rounded-xl cursor-pointer h-48 md:h-full md:flex-grow md:transition-all md:w-56 md:duration-500 md:hover:w-full"
                        >
                            <img
                                className="h-full w-full object-cover object-center"
                                src={img.src}
                                alt={img.alt}
                                loading="lazy"
                            />

                            {/* Gradient overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-midtown-navy/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                                    <h3 className="text-white font-heading font-semibold text-sm md:text-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                        {img.alt}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="text-center mt-16"
                >
                    <p className="text-gray-600 text-lg mb-6">
                        Want to see your property transformed like these?
                    </p>
                    <a
                        href="#contact"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-midtown-navy text-white rounded-full font-semibold hover:bg-midtown-navy/90 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                        Get Your Free Quote
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </a>
                </motion.div>
            </div>
        </section>
    );
};

export default Portfolio;
