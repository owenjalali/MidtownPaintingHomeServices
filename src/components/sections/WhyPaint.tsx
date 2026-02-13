
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const painPoints = [
    { stat: '40%', label: 'of repair costs are preventable with paint' },
    { stat: '5–7yr', label: 'lifespan of quality exterior paint' },
    { stat: '$10K+', label: 'average cost of untreated wood rot' },
    { stat: '15%', label: 'increase in home value with fresh paint' },
];

const WhyPaint: React.FC = () => {
    return (
        <section className="py-24 bg-midtown-dark relative overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-midtown-navy/30 to-transparent" />

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-2xl mx-auto mb-16"
                >
                    <span className="text-midtown-orange font-semibold tracking-[0.2em] uppercase text-sm">
                        Why It Matters
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-white mt-4 mb-4 leading-tight">
                        Paint Protects Your
                        <span className="text-midtown-orange"> Investment</span>
                    </h2>
                    <p className="text-gray-400 text-lg">
                        Every season without protection costs you more. Don't wait until damage becomes structural.
                    </p>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
                    {painPoints.map((point, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10"
                        >
                            <div className="text-3xl md:text-4xl font-heading font-bold text-midtown-orange mb-2">
                                {point.stat}
                            </div>
                            <p className="text-gray-400 text-sm leading-snug">
                                {point.label}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Before photo + CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col items-center gap-8"
                >
                    <div className="rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full border border-white/10">
                        <img
                            src="/images/rotting-wood.jpg"
                            alt="Chipped and peeling paint showing damage"
                            className="w-full h-56 object-cover"
                        />
                    </div>

                    <a
                        href="#contact"
                        className="inline-flex items-center gap-2 bg-midtown-orange text-white px-8 py-4 rounded-full font-semibold text-lg hover:brightness-110 transition-all shadow-lg shadow-midtown-orange/20"
                    >
                        Protect Your Home
                        <ArrowRight className="w-5 h-5" />
                    </a>
                </motion.div>
            </div>
        </section>
    );
};

export default WhyPaint;
