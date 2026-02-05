import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import {
    ContainerScroll,
    CardsContainer,
    CardTransformed,
    ReviewStars,
} from '../ui/ScrollCards';

const testimonials = [
    {
        id: '1',
        name: 'Sarah M.',
        location: 'Toronto',
        rating: 5,
        text: "Carter and his team did an incredible job on our living room and kitchen. The attention to detail was amazing, and they finished ahead of schedule. Highly recommend!",
        project: 'Interior Painting',
    },
    {
        id: '2',
        name: 'Michael T.',
        location: 'Mississauga',
        rating: 5,
        text: "Best painting experience we've ever had. Professional, clean, and the results exceeded our expectations. Our deck looks brand new!",
        project: 'Deck Staining',
    },
    {
        id: '3',
        name: 'Jennifer L.',
        location: 'North York',
        rating: 5,
        text: "From quote to completion, everything was smooth and professional. Carter kept us updated throughout the process. Our exterior looks stunning!",
        project: 'Exterior Painting',
    },
    {
        id: '4',
        name: 'David K.',
        location: 'Etobicoke',
        rating: 5,
        text: "Great price, great quality, great communication. What more could you ask for? Will definitely use Midtown Painting again for our office.",
        project: 'Commercial Painting',
    },
];

const Testimonials: React.FC = () => {
    return (
        <section id="testimonials" className="bg-midtown-navy overflow-hidden">
            <ContainerScroll className="min-h-[300vh]">
                {/* Sticky wrapper keeps content visible while scrolling drives card animations */}
                <div className="sticky top-0 min-h-screen flex flex-col items-center justify-center px-6 py-20">
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
                            Don't just take our word for it – scroll to see reviews from our satisfied customers across the GTA.
                        </p>
                    </motion.div>

                    {/* Animated Scroll Cards */}
                    <CardsContainer className="h-[340px] md:h-[380px] w-full max-w-sm md:max-w-lg mx-auto">
                        {testimonials.map((testimonial, index) => (
                            <CardTransformed
                                key={testimonial.id}
                                arrayLength={testimonials.length}
                                index={index}
                                variant="light"
                                incrementRotation={-index * 3 + 15}
                            >
                                {/* Quote icon */}
                                <Quote className="w-8 h-8 text-midtown-orange/30 absolute top-4 right-4" />

                                {/* Stars */}
                                <ReviewStars
                                    rating={testimonial.rating}
                                    className="text-midtown-orange"
                                />

                                {/* Review text */}
                                <p className="text-gray-700 text-center leading-relaxed italic text-sm md:text-base">
                                    "{testimonial.text}"
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-midtown-navy flex items-center justify-center text-white font-bold text-sm">
                                        {testimonial.name.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-heading font-bold text-midtown-navy text-sm">
                                            {testimonial.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {testimonial.location} · {testimonial.project}
                                        </div>
                                    </div>
                                </div>
                            </CardTransformed>
                        ))}
                    </CardsContainer>
                </div>
            </ContainerScroll>

            {/* Stats & CTA - below the scroll area */}
            <div className="container mx-auto px-6 pb-20">
                {/* Stats Row */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="grid grid-cols-3 gap-8 max-w-2xl mx-auto"
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
