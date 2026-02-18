import React from 'react';
import { motion } from 'framer-motion';
import TestimonialSlider from '../ui/TestimonialSlider';

const testimonials = [
    {
        name: 'Heather Kavanaugh',
        location: 'Toronto',
        rating: 5,
        text: "A really nice job on both the inside and outside projects.",
        project: 'Interior & Exterior Painting',
    },
    {
        name: 'Ramaneck Gill',
        location: 'Toronto',
        rating: 5,
        text: "The crew was knowledgeable, provided good feedback, respectful, and had great work ethic. They did a great job. I am very happy with the end result and would highly recommend them to others.",
        project: 'Painting',
    },
    {
        name: 'Leslie Howard',
        location: 'Toronto',
        rating: 5,
        text: "I was very pleased with both painters assigned to the job. Lovely people and very personable. They went above and beyond to take care of everything, and they did an excellent job. Everything looks beautiful. Carter was great to deal with from start to finish. He is an excellent manager.",
        project: 'Painting',
    },
    {
        name: 'Helen Poulos',
        location: 'Toronto',
        rating: 5,
        text: "I highly recommend StudentWorks. They were very friendly, respectful, and worked very hard throughout the day. The project was completed in the full day and the completed work was of high quality. I will not hesitate to contact them again for future painting or other jobs.",
        project: 'Painting',
    },
    {
        name: 'Ann Bonsy',
        location: 'Toronto',
        rating: 5,
        text: "Excellent. Sean and Ethan were very courteous and did a great job cleaning our deck. I would highly recommend them.",
        project: 'Deck Cleaning',
    },
    {
        name: 'Jerry Thomas',
        location: 'East York, Toronto',
        rating: 5,
        text: "Excellent and diligent work. The team performed incredibly well, were very professional, and finished in a great amount of time.",
        project: 'Painting',
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
                        <div className="text-3xl md:text-5xl font-heading font-bold text-midtown-orange">70+</div>
                        <div className="text-white/80 text-sm mt-2">Projects Completed</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-5xl font-heading font-bold text-midtown-orange">5.0</div>
                        <div className="text-white/80 text-sm mt-2">Average Rating</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-5xl font-heading font-bold text-midtown-orange">4+</div>
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
