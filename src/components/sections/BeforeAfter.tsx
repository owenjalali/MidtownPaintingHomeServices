import React from 'react';
import { motion } from 'framer-motion';
import ImageComparisonSlider from '../ui/ImageComparisonSlider';

const beforeAfterData = [
    {
        id: '1',
        before: '/images/work-1.png',
        after: '/images/work-2.png',
        title: 'Deck Staining',
    },
    {
        id: '2',
        before: '/images/interior-before.png',
        after: '/images/interior-after.png',
        title: 'Interior Redesign',
    },
    {
        id: '3',
        before: '/images/exterior-before.png',
        after: '/images/exterior-after.png',
        title: 'Exterior Restoration',
    },
];

const BeforeAfter: React.FC = () => {
    return (
        <section id="gallery" className="py-20 lg:py-32 bg-gradient-to-br from-midtown-light to-white">
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
                        Our Work
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-6">
                        See the Transformation
                    </h2>
                    <p className="text-gray-600 text-lg">
                        Drag the slider to see the dramatic before and after results of our professional painting work.
                    </p>
                </motion.div>

                {/* Before/After Sliders */}
                <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {beforeAfterData.slice(0, 2).map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.2 }}
                        >
                            <ImageComparisonSlider
                                beforeImage={item.before}
                                afterImage={item.after}
                                beforeAlt={`${item.title} - Before`}
                                afterAlt={`${item.title} - After`}
                                className="shadow-xl"
                            />
                            <p className="text-center mt-4 font-heading font-semibold text-midtown-navy">
                                {item.title}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Full-width third slider */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-8 max-w-4xl mx-auto"
                >
                    <ImageComparisonSlider
                        beforeImage={beforeAfterData[2].before}
                        afterImage={beforeAfterData[2].after}
                        beforeAlt={`${beforeAfterData[2].title} - Before`}
                        afterAlt={`${beforeAfterData[2].title} - After`}
                        className="shadow-xl"
                    />
                    <p className="text-center mt-4 font-heading font-semibold text-midtown-navy">
                        {beforeAfterData[2].title}
                    </p>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="text-center mt-16"
                >
                    <p className="text-gray-600 text-lg mb-6">
                        Want results like these for your property?
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

export default BeforeAfter;
