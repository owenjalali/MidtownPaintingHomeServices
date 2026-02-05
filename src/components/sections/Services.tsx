
import React from 'react';
import { motion } from 'framer-motion';
import { Paintbrush, Home, Building2, Fence } from 'lucide-react';

const services = [
    {
        icon: Paintbrush,
        title: 'Interior Painting',
        description: 'Transform your living spaces with expert wall, ceiling, and trim painting. Premium finishes that last.',
    },
    {
        icon: Home,
        title: 'Exterior Painting',
        description: 'Boost your curb appeal with weather-resistant exterior painting. Siding, trim, and more.',
    },
    {
        icon: Fence,
        title: 'Deck & Fence Staining',
        description: 'Protect and beautify your outdoor wood surfaces with professional staining and sealing.',
    },
    {
        icon: Building2,
        title: 'Commercial Painting',
        description: 'Professional painting solutions for offices, retail spaces, and commercial properties.',
    },
];

const Services: React.FC = () => {
    return (
        <section id="services" className="py-20 lg:py-32 bg-white">
            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <span className="text-midtown-orange font-semibold text-sm uppercase tracking-wider">
                        Our Services
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-6">
                        Professional Painting Services for Every Need
                    </h2>
                    <p className="text-gray-600 text-lg">
                        From cozy homes to commercial spaces, we deliver exceptional quality with every brushstroke.
                    </p>
                </motion.div>

                {/* Services Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {services.map((service, index) => (
                        <motion.div
                            key={service.title}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ y: -10, transition: { duration: 0.3 } }}
                            className="group relative bg-gradient-to-br from-midtown-light to-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
                        >
                            {/* Icon */}
                            <div className="w-14 h-14 bg-midtown-navy rounded-xl flex items-center justify-center mb-6 group-hover:bg-midtown-orange transition-colors duration-300">
                                <service.icon className="w-7 h-7 text-white" />
                            </div>

                            {/* Content */}
                            <h3 className="text-xl font-heading font-bold text-midtown-navy mb-3">
                                {service.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                {service.description}
                            </p>

                            {/* Hover accent */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-midtown-orange to-midtown-blue rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Services;
