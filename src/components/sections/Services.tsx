
import React from 'react';
import { motion } from 'framer-motion';

const services = [
    {
        title: 'Interior Painting',
        description: 'Walls, ceilings, trim — premium finishes that transform your living spaces.',
        image: '/images/service-interior.png',
        span: 'md:col-span-2 md:row-span-2',
    },
    {
        title: 'Exterior Painting',
        description: 'Weather-resistant coatings that boost curb appeal and protect your home.',
        image: '/images/service-exterior.png',
        span: 'md:col-span-1 md:row-span-1',
    },
    {
        title: 'Deck & Fence Staining',
        description: 'Professional staining and sealing for lasting outdoor beauty.',
        image: '/images/service-deck.png',
        span: 'md:col-span-1 md:row-span-1',
    },
    {
        title: 'Commercial Painting',
        description: 'Offices, retail, and commercial spaces — on time, on budget.',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&fit=crop',
        span: 'md:col-span-2 md:row-span-1',
    },
];

const Services: React.FC = () => {
    return (
        <section id="services" className="py-24 lg:py-32 bg-white">
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
                        Our Services
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-4">
                        What We Do Best
                    </h2>
                    <p className="text-gray-500 text-lg">
                        Premium painting services for homes and businesses across the GTA.
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
                    {services.map((service, index) => (
                        <motion.div
                            key={service.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`group relative overflow-hidden rounded-2xl cursor-pointer ${service.span}`}
                            style={{ minHeight: index === 0 ? '400px' : '200px' }}
                        >
                            {/* Image */}
                            <img
                                src={service.image}
                                alt={service.title}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-midtown-dark/80 via-midtown-dark/20 to-transparent" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                                <h3 className="text-xl md:text-2xl font-heading font-bold text-white mb-1">
                                    {service.title}
                                </h3>
                                <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-md">
                                    {service.description}
                                </p>
                            </div>

                            {/* Hover accent line */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-midtown-orange transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Services;
