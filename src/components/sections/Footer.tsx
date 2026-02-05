
import React from 'react';
import { Phone, Mail, MapPin, Instagram, Facebook } from 'lucide-react';

const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-midtown-dark text-white">
            <div className="container mx-auto px-6 py-16">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                    {/* Logo & Description */}
                    <div className="lg:col-span-2">
                        <img src="/images/logo.png" alt="Midtown Painting" className="h-20 mb-6" />
                        <p className="text-gray-400 leading-relaxed max-w-md">
                            Transform your space with GTA's most trusted painters. 50+ projects completed with 5-star reviews.
                            Fully insured with $5M liability coverage.
                        </p>
                        <div className="flex gap-4 mt-6">
                            <a
                                href="https://www.instagram.com/midtownpaintinghomeservices/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-midtown-orange transition-colors"
                            >
                                <Instagram className="w-5 h-5" />
                            </a>
                            <a
                                href="https://www.facebook.com/people/Midtown-Painting-Home-Services/61561376396347/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-midtown-orange transition-colors"
                            >
                                <Facebook className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-heading font-bold text-lg mb-6">Quick Links</h4>
                        <ul className="space-y-3">
                            {['Services', 'Gallery', 'About', 'Testimonials', 'FAQ', 'Contact'].map((link) => (
                                <li key={link}>
                                    <a
                                        href={`#${link.toLowerCase()}`}
                                        className="text-gray-400 hover:text-midtown-orange transition-colors"
                                    >
                                        {link}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="font-heading font-bold text-lg mb-6">Contact Us</h4>
                        <ul className="space-y-4">
                            <li>
                                <a href="tel:+16479669108" className="flex items-center gap-3 text-gray-400 hover:text-midtown-orange transition-colors">
                                    <Phone className="w-5 h-5" />
                                    (647) 966-9108
                                </a>
                            </li>
                            <li>
                                <a href="mailto:carterliamjenkins@icloud.com" className="flex items-center gap-3 text-gray-400 hover:text-midtown-orange transition-colors">
                                    <Mail className="w-5 h-5" />
                                    carterliamjenkins@icloud.com
                                </a>
                            </li>
                            <li className="flex items-center gap-3 text-gray-400">
                                <MapPin className="w-5 h-5" />
                                Greater Toronto Area
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-400 text-sm">
                        © {currentYear} Midtown Painting Home Services. All rights reserved.
                    </p>
                    <p className="text-gray-400 text-sm">
                        $5M Liability Insurance • WSIB Covered • Serving the GTA
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
