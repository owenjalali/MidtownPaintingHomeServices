
import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Star, Clock, Award } from 'lucide-react';
import TextFrameBorder from '../ui/TextFrameBorder';

const About: React.FC = () => {
    return (
        <section id="about" className="py-20 lg:py-32 bg-white overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    {/* Left Column - Image with Text Frame */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="relative flex justify-center"
                    >
                        {/* Text Frame Border around Carter's photo */}
                        <TextFrameBorder
                            imageSrc="/images/carter.png"
                            text="✦ QUALITY ✦ TRUSTED ✦ PROFESSIONAL ✦ GTA'S BEST ✦ 50+ PROJECTS "
                            size={350}
                            className="relative z-10"
                        />

                        {/* Decorative background element */}
                        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-midtown-orange/10 rounded-full blur-3xl" />
                        <div className="absolute -right-10 -top-10 w-48 h-48 bg-midtown-blue/10 rounded-full blur-3xl" />
                    </motion.div>

                    {/* Right Column - Content */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className="text-midtown-orange font-semibold text-sm uppercase tracking-wider">
                            About Us
                        </span>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-6">
                            Meet Carter Jenkins
                        </h2>
                        <p className="text-gray-600 text-lg leading-relaxed mb-6">
                            Hi, I'm Carter! A McGill University 2nd-year student with a passion for transforming spaces.
                            What started as summer painting jobs has grown into <strong>Midtown Painting Home Services</strong> –
                            a company built on quality, reliability, and attention to detail.
                        </p>
                        <p className="text-gray-600 text-lg leading-relaxed mb-8">
                            Over the past <strong>3 years</strong>, I've personally overseen <strong>50+ projects</strong> across
                            the Greater Toronto Area, earning <strong>5-star reviews</strong> from every client. My team and I
                            treat every home like it's our own.
                        </p>

                        {/* Trust Badges */}
                        <div className="grid grid-cols-2 gap-6">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-3 p-4 bg-midtown-light rounded-xl"
                            >
                                <div className="w-12 h-12 bg-midtown-navy rounded-lg flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-midtown-navy">$5M Insured</div>
                                    <div className="text-sm text-gray-500">Liability Coverage</div>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-3 p-4 bg-midtown-light rounded-xl"
                            >
                                <div className="w-12 h-12 bg-midtown-orange rounded-lg flex items-center justify-center">
                                    <Award className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-midtown-navy">WSIB</div>
                                    <div className="text-sm text-gray-500">Warranty Covered</div>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-3 p-4 bg-midtown-light rounded-xl"
                            >
                                <div className="w-12 h-12 bg-midtown-blue rounded-lg flex items-center justify-center">
                                    <Star className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-midtown-navy">50+</div>
                                    <div className="text-sm text-gray-500">Projects Completed</div>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-3 p-4 bg-midtown-light rounded-xl"
                            >
                                <div className="w-12 h-12 bg-midtown-navy rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-midtown-navy">3 Years</div>
                                    <div className="text-sm text-gray-500">In Business</div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default About;
