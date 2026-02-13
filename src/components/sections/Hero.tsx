
import React from 'react';
import { motion } from 'framer-motion';
import { Phone, ArrowRight } from 'lucide-react';

const Hero: React.FC = () => {
    return (
        <section id="hero" className="relative min-h-screen flex items-end overflow-hidden">
            {/* Full-bleed background image */}
            <div className="absolute inset-0">
                <img
                    src="/images/d0a03533-499b-42c8-93c2-2c6aca1056f3.jpg"
                    alt="Artistic city skyline painting with bold paint strokes"
                    className="w-full h-full object-cover"
                />
                {/* Gradient overlays for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/95 via-[#0a1628]/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/70 via-transparent to-transparent" />
            </div>

            {/* Content — bottom-left */}
            <div className="container mx-auto px-6 md:px-10 relative z-10 pb-16 md:pb-20 pt-32">
                <div className="max-w-2xl">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-midtown-orange/30 rounded-full px-5 py-2.5 mb-8"
                    >
                        <div className="w-2 h-2 bg-midtown-orange rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-white/90">Now Booking Summer 2026</span>
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.1 }}
                        className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-white leading-[1.05] mb-6"
                    >
                        Toronto's Most
                        <br />
                        <span className="bg-gradient-to-r from-midtown-orange via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                            Trusted
                        </span>{' '}
                        Painters
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-white/80 text-lg md:text-xl leading-relaxed mb-10 max-w-lg"
                    >
                        Professional interior &amp; exterior painting across the GTA.
                        70+ projects completed with a perfect 5-star rating.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-wrap gap-4 mb-12"
                    >
                        <a
                            href="#contact"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-midtown-orange to-amber-500 text-white rounded-full font-semibold text-lg hover:scale-105 hover:shadow-xl hover:shadow-midtown-orange/25 transition-all duration-300"
                        >
                            Get Your Free Quote
                            <ArrowRight className="w-5 h-5" />
                        </a>
                        <a
                            href="tel:+16479669108"
                            className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-full font-semibold text-lg hover:bg-white/20 transition-all"
                        >
                            <Phone className="w-5 h-5" />
                            (647) 966-9108
                        </a>
                    </motion.div>

                    {/* Trust indicators */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="flex flex-wrap gap-8"
                    >
                        {[
                            { label: '70+', sub: 'Projects' },
                            { label: '5.0★', sub: 'Rating' },
                            { label: '$5M', sub: 'Insured' },
                            { label: '4 Yrs', sub: 'Experience' },
                        ].map((stat) => (
                            <div key={stat.label} className="text-center">
                                <div className="text-2xl font-heading font-bold text-white">{stat.label}</div>
                                <div className="text-sm text-white/60">{stat.sub}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
