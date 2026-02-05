import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Shield, Clock, Star } from 'lucide-react';
import WetPaintButton from '../ui/WetPaintButton';

const Hero: React.FC = () => {
    return (
        <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-midtown-light via-white to-blue-50">
            {/* Watercolor Paint Splash Background */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    <filter id="watercolor-bleed">
                        <feTurbulence type="fractalNoise" baseFrequency="0.01 0.03" numOctaves="4" seed="2" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="120" />
                    </filter>
                    <filter id="watercolor-bleed-2">
                        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.025" numOctaves="3" seed="5" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="90" />
                    </filter>
                </defs>
            </svg>

            {/* Animated Watercolor Canvas */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none watercolor-canvas">
                {/* Large vibrant pink/magenta splotch */}
                <div className="splotch splotch-pink" style={{ filter: 'url(#watercolor-bleed)' }}></div>
                {/* Warm orange/coral splotch */}
                <div className="splotch splotch-orange" style={{ filter: 'url(#watercolor-bleed-2)' }}></div>
                {/* Deep purple splotch */}
                <div className="splotch splotch-purple" style={{ filter: 'url(#watercolor-bleed)' }}></div>
                {/* Soft blue accent */}
                <div className="splotch splotch-blue" style={{ filter: 'url(#watercolor-bleed-2)' }}></div>
                {/* Golden highlight */}
                <div className="splotch splotch-gold" style={{ filter: 'url(#watercolor-bleed)' }}></div>
            </div>

            {/* Content */}
            <div className="relative z-10 container mx-auto px-6 py-20 lg:py-32 pt-32">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    {/* Left Column - Text */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 lg:bg-transparent lg:backdrop-blur-none lg:p-0 lg:rounded-none"
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 bg-midtown-orange/10 text-midtown-orange px-4 py-2 rounded-full text-sm font-semibold mb-6"
                        >
                            <span className="flex items-center">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star key={i} className="w-4 h-4 fill-current" />
                                ))}
                            </span>
                            <span>5-Star Rated in the GTA</span>
                        </motion.div>

                        {/* Main Heading */}
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-midtown-navy leading-tight mb-6"
                        >
                            Transform Your Space with{' '}
                            <span className="text-midtown-orange">GTA's Most Trusted</span> Painters
                        </motion.h1>

                        {/* Subheading */}
                        <motion.p
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl"
                        >
                            50+ projects completed with 5-star reviews. Fully insured with $5M liability coverage.
                            <span className="font-semibold text-midtown-navy"> Get 10% off when you book on quote day!</span>
                        </motion.p>

                        {/* CTA Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="flex flex-wrap gap-4"
                        >
                            <WetPaintButton
                                size="lg"
                                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                            >
                                Get Your Free Quote
                            </WetPaintButton>

                            <a
                                href="tel:+16479669108"
                                className="inline-flex items-center gap-2 px-6 py-4 border-2 border-midtown-navy text-midtown-navy rounded-full font-semibold hover:bg-midtown-navy hover:text-white transition-all duration-300"
                            >
                                <Phone className="w-5 h-5" />
                                (647) 966-9108
                            </a>
                        </motion.div>

                        {/* Trust Indicators */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex flex-wrap gap-6 mt-10 pt-10"
                        >
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Shield className="w-5 h-5 text-midtown-blue" />
                                <span>$5M Liability Insurance</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Shield className="w-5 h-5 text-midtown-blue" />
                                <span>WSIB Covered</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock className="w-5 h-5 text-midtown-blue" />
                                <span>3 Years in Business</span>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Right Column - Logo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative flex justify-center items-center"
                    >
                        <motion.div
                            animate={{ y: [0, -15, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            className="relative z-10"
                        >
                            <img
                                src="/images/logo.png"
                                alt="Midtown Painting Home Services"
                                className="w-48 sm:w-64 md:w-80 lg:w-96 drop-shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>
                </div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
            >
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-6 h-10 border-2 border-midtown-navy/30 rounded-full flex justify-center pt-2"
                >
                    <div className="w-1.5 h-3 bg-midtown-navy/30 rounded-full" />
                </motion.div>
            </motion.div>
        </section>
    );
};

export default Hero;
