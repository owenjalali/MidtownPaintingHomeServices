import React from 'react';
import { motion } from 'framer-motion';
import TestimonialSlider from '../ui/TestimonialSlider';

const testimonials = [
    {
        name: 'Sarah M.',
        location: 'Toronto',
        rating: 5,
        text: "Carter and his team did an incredible job on our living room and kitchen. The attention to detail was amazing, and they finished ahead of schedule. Highly recommend!",
        project: 'Interior Painting',
    },
    {
        name: 'Michael T.',
        location: 'Mississauga',
        rating: 5,
        text: "Best painting experience we've ever had. Professional, clean, and the results exceeded our expectations. Our deck looks brand new!",
        project: 'Deck Staining',
    },
    {
        name: 'Jennifer L.',
        location: 'North York',
        rating: 5,
        text: "From quote to completion, everything was smooth and professional. Carter kept us updated throughout the process. Our exterior looks stunning!",
        project: 'Exterior Painting',
    },
    {
        name: 'David K.',
        location: 'Etobicoke',
        rating: 5,
        text: "Great price, great quality, great communication. What more could you ask for? Will definitely use Midtown Painting again for our office.",
        project: 'Commercial Painting',
    },
];

const Testimonials: React.FC = () => {
    return (
        <section id="testimonials" className="bg-midtown-navy py-20 lg:py-32">
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
                        Testimonials
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-white mt-4 mb-6">
                        What Our Clients Say
                    </h2>
                    <p className="text-midtown-blue text-lg">
                        Don't just take our word for it – hear from our satisfied customers across the GTA.
                    </p>
                </motion.div>

                {/* Testimonial Slider */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <TestimonialSlider testimonials={testimonials} />
                </motion.div>

                {/* Stats Row */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16"
                >
                    <div className="text-center">
                        <div className="text-3xl md:text-5xl font-heading font-bold text-midtown-orange">50+</div>
                        <div className="text-white/80 text-sm mt-2">Projects Completed</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-5xl font-heading font-bold text-midtown-orange">5.0</div>
                        <div className="text-white/80 text-sm mt-2">Average Rating</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-5xl font-heading font-bold text-midtown-orange">3+</div>
                        <div className="text-white/80 text-sm mt-2">Years in Business</div>
                    </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="text-center mt-12"
                >
                    <p className="text-midtown-blue text-lg mb-4">
                        Ready to join our satisfied customers?
                    </p>
                    <a
                        href="#contact"
                        className="inline-block px-8 py-4 bg-midtown-orange text-white rounded-full font-semibold hover:bg-midtown-orange/90 transition-colors"
                    >
                        Get Your Free Quote
                    </a>
                </motion.div>
            </div>
        </section>
    );
};

export default Testimonials;
