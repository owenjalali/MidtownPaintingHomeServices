
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Send, Instagram, Facebook } from 'lucide-react';
import WetPaintButton from '../ui/WetPaintButton';

const Contact: React.FC = () => {
    const [formState, setFormState] = useState({
        name: '',
        email: '',
        phone: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate form submission
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSubmitted(true);
            setFormState({ name: '', email: '', phone: '', message: '' });
        }, 1000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <section id="contact" className="py-20 lg:py-32 bg-white">
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
                        Contact Us
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-6">
                        Ready to Transform Your Space?
                    </h2>
                    <p className="text-gray-600 text-lg">
                        Get a free quote today – no obligation, no pressure. We'll get back to you within 24 hours.
                    </p>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 max-w-6xl mx-auto">
                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        {isSubmitted ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center"
                            >
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="font-heading font-bold text-xl text-green-800 mb-2">
                                    Message Sent!
                                </h3>
                                <p className="text-green-600">
                                    Thanks for reaching out! We'll get back to you within 24 hours.
                                </p>
                                <button
                                    onClick={() => setIsSubmitted(false)}
                                    className="mt-4 text-midtown-navy underline"
                                >
                                    Send another message
                                </button>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formState.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-midtown-orange focus:border-transparent transition-all outline-none"
                                            placeholder="John Smith"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone Number *
                                        </label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={formState.phone}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-midtown-orange focus:border-transparent transition-all outline-none"
                                            placeholder="(416) 123-4567"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formState.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-midtown-orange focus:border-transparent transition-all outline-none"
                                        placeholder="john@example.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                                        Tell us about your project
                                    </label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        value={formState.message}
                                        onChange={handleChange}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-midtown-orange focus:border-transparent transition-all outline-none resize-none"
                                        placeholder="I'm looking to paint my living room and kitchen..."
                                    />
                                </div>

                                <WetPaintButton
                                    size="lg"
                                    className={`w-full justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? 'Sending...' : 'Get My Free Quote'}
                                </WetPaintButton>

                                <p className="text-sm text-gray-500 text-center">
                                    📅 Book on quote day and get <span className="text-midtown-orange font-semibold">10% off</span>!
                                </p>
                            </form>
                        )}
                    </motion.div>

                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-8"
                    >
                        {/* Contact Cards */}
                        <div className="space-y-4">
                            <a
                                href="tel:+16479669108"
                                className="flex items-center gap-4 p-5 bg-midtown-light rounded-xl hover:bg-midtown-navy hover:text-white group transition-all"
                            >
                                <div className="w-12 h-12 bg-midtown-navy group-hover:bg-midtown-orange rounded-lg flex items-center justify-center transition-colors">
                                    <Phone className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold group-hover:text-white">Call Us</div>
                                    <div className="text-gray-600 group-hover:text-midtown-blue">(647) 966-9108</div>
                                </div>
                            </a>

                            <a
                                href="mailto:carterliamjenkins@icloud.com"
                                className="flex items-center gap-4 p-5 bg-midtown-light rounded-xl hover:bg-midtown-navy hover:text-white group transition-all"
                            >
                                <div className="w-12 h-12 bg-midtown-navy group-hover:bg-midtown-orange rounded-lg flex items-center justify-center transition-colors">
                                    <Mail className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold group-hover:text-white">Email Us</div>
                                    <div className="text-gray-600 group-hover:text-midtown-blue">carterliamjenkins@icloud.com</div>
                                </div>
                            </a>

                            <div className="flex items-center gap-4 p-5 bg-midtown-light rounded-xl">
                                <div className="w-12 h-12 bg-midtown-navy rounded-lg flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-midtown-navy">Service Area</div>
                                    <div className="text-gray-600">Greater Toronto Area (GTA)</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-5 bg-midtown-light rounded-xl">
                                <div className="w-12 h-12 bg-midtown-navy rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-midtown-navy">Response Time</div>
                                    <div className="text-gray-600">Within 24 hours</div>
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="pt-8 border-t border-gray-200">
                            <h3 className="font-heading font-bold text-midtown-navy mb-4">Follow Us</h3>
                            <div className="flex gap-4">
                                <a
                                    href="https://www.instagram.com/midtownpaintinghomeservices/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-xl flex items-center justify-center hover:scale-110 transition-transform"
                                >
                                    <Instagram className="w-6 h-6 text-white" />
                                </a>
                                <a
                                    href="https://www.facebook.com/people/Midtown-Painting-Home-Services/61561376396347/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center hover:scale-110 transition-transform"
                                >
                                    <Facebook className="w-6 h-6 text-white" />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default Contact;
