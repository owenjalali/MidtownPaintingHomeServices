import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Menu, X } from 'lucide-react';

const navLinks = [
    { name: 'Home', href: '#' },
    { name: 'Services', href: '#services' },
    { name: 'Gallery', href: '#gallery' },
    { name: 'About', href: '#about' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Contact', href: '#contact' },
];

const Navbar: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
                        ? 'bg-white/95 backdrop-blur-md shadow-lg'
                        : 'bg-transparent'
                    }`}
            >
                <div className="container mx-auto px-6">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <a href="#" className="flex items-center gap-3">
                            <img
                                src="/images/logo.png"
                                alt="Midtown Painting"
                                className="h-12 w-auto"
                            />
                            <div className="hidden sm:block">
                                <span className="font-heading font-bold text-xl text-midtown-navy">
                                    Midtown
                                </span>
                                <span className="font-heading font-bold text-xl text-midtown-orange">
                                    {' '}Painting
                                </span>
                            </div>
                        </a>

                        {/* Desktop Navigation */}
                        <div className="hidden lg:flex items-center gap-8">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    className={`font-medium transition-colors hover:text-midtown-orange ${isScrolled ? 'text-midtown-dark' : 'text-midtown-navy'
                                        }`}
                                >
                                    {link.name}
                                </a>
                            ))}
                        </div>

                        {/* CTA Button & Mobile Menu Toggle */}
                        <div className="flex items-center gap-4">
                            {/* Phone CTA - Desktop */}
                            <a
                                href="tel:+16479669108"
                                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-midtown-orange text-white rounded-full font-semibold hover:bg-midtown-orange/90 transition-all duration-300 shadow-md hover:shadow-lg"
                            >
                                <Phone className="w-4 h-4" />
                                <span>(647) 966-9108</span>
                            </a>

                            {/* Mobile Menu Toggle */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                aria-label="Toggle menu"
                            >
                                {isMobileMenuOpen ? (
                                    <X className="w-6 h-6 text-midtown-navy" />
                                ) : (
                                    <Menu className="w-6 h-6 text-midtown-navy" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-x-0 top-20 z-40 bg-white shadow-xl lg:hidden"
                    >
                        <div className="container mx-auto px-6 py-6">
                            <div className="flex flex-col gap-4">
                                {navLinks.map((link) => (
                                    <a
                                        key={link.name}
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="text-lg font-medium text-midtown-navy hover:text-midtown-orange transition-colors py-2 border-b border-gray-100"
                                    >
                                        {link.name}
                                    </a>
                                ))}
                                <a
                                    href="tel:+16479669108"
                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-midtown-orange text-white rounded-full font-semibold mt-4"
                                >
                                    <Phone className="w-5 h-5" />
                                    <span>(647) 966-9108</span>
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-30 bg-black/20 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default Navbar;
