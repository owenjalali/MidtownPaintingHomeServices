
import React from 'react';
import { motion } from 'framer-motion';

const stats = [
    { value: '70+', label: 'Projects' },
    { value: '4 Yrs', label: 'Experience' },
    { value: '$5M', label: 'Insured' },
    { value: '5.0★', label: 'Rating' },
];

const About: React.FC = () => {
    return (
        <section id="about" className="py-24 bg-midtown-light">
            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <span className="text-midtown-orange font-semibold tracking-[0.2em] uppercase text-sm">
                        About the Founder
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4">
                        Meet Carter Jenkins
                    </h2>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-16 items-center max-w-5xl mx-auto">
                    {/* Left: Photos */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-6"
                    >
                        {/* Carter's headshot */}
                        <div className="flex justify-center">
                            <div className="w-64 h-64 md:w-72 md:h-72 rounded-2xl overflow-hidden shadow-xl">
                                <img
                                    src="/images/carter.png"
                                    alt="Carter Jenkins - Founder of Midtown Painting"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Team photo */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="rounded-2xl overflow-hidden shadow-xl"
                        >
                            <img
                                src="/images/team.png"
                                alt="Student Works Management Program team"
                                className="w-full h-64 object-cover object-[center_25%]"
                            />
                            <div className="bg-midtown-navy px-5 py-3">
                                <p className="text-white/90 text-sm font-medium">
                                    Student Works Management Program
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Right: Bio */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-6"
                    >
                        <div className="space-y-5">
                            <p className="text-gray-700 text-lg leading-relaxed">
                                I'm Carter Jenkins, a second-year economics student at
                                <strong> McGill University</strong> and founder of Midtown Painting. This is my
                                <strong> fourth year</strong> in the painting industry and my
                                <strong> third year</strong> running my own business.
                            </p>
                            <p className="text-gray-700 text-lg leading-relaxed">
                                Last summer, my team completed <strong>70+ projects</strong> across
                                the Greater Toronto Area, earning a <strong>5-star rating</strong> from
                                every client. This summer, our goal is <strong>130+ projects</strong>.
                            </p>
                            <p className="text-gray-700 text-lg leading-relaxed">
                                We use only the highest-quality Sherwin-Williams materials, and my team
                                includes many returning skilled painters. We're backed by experienced coaches
                                from <strong>The Student Works Management Program</strong>.
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-200">
                            {stats.map((stat, index) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="text-center"
                                >
                                    <div className="text-xl font-heading font-bold text-midtown-navy">{stat.value}</div>
                                    <div className="text-xs text-gray-500">{stat.label}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default About;
