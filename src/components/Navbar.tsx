import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Menu, X } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Navbar = () => {
    const navRef = useRef<HTMLElement>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    const isPartnerships = location.pathname === '/partnerships';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <>
            <nav
                ref={navRef}
                className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl rounded-[2rem] px-6 py-4 transition-all duration-500 flex items-center justify-between ${isScrolled || isMobileMenuOpen
                    ? 'glass-nav text-black shadow-sm bg-white'
                    : isPartnerships ? 'bg-transparent text-black drop-shadow-none' : 'bg-transparent text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]'
                    }`}
            >
                <div className="flex items-center gap-3 relative z-50">
                    <img src="/images/logo-midtown.png" alt="Midtown Painting Home Services" className="h-10 w-auto object-contain drop-shadow-md" />
                    <span className="font-heading font-bold text-xl tracking-tight hidden sm:block">
                        MidtownPaintingHomeServices
                    </span>
                </div>

                <div className="hidden lg:flex items-center gap-6 font-body text-sm font-medium">
                    <a href="/#" className="hover-lift">Home</a>
                    <a href="/#services" className="hover-lift">Services</a>
                    <a href="/#process" className="hover-lift">Process</a>
                    <a href="/#gallery" className="hover-lift">Gallery</a>
                    <a href="/#testimonials" className="hover-lift">Testimonials</a>
                    <a href="/#about" className="hover-lift">About</a>
                    <a href="/#faq" className="hover-lift">FAQ</a>
                    <a href="/partnerships" className="hover-lift">Partnerships & Certifications</a>
                </div>

                <div className="flex items-center gap-4 relative z-50">
                    <button
                        onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('open-quote')); }}
                        className="btn-magnetic px-5 py-2.5 md:px-6 md:py-3 rounded-full text-sm font-semibold border border-current hover:border-transparent group hidden sm:inline-flex"
                    >
                        <span className="bg-layer rounded-full"></span>
                        <span className={`content-layer transition-colors duration-300 ${isScrolled || isPartnerships || isMobileMenuOpen ? 'text-black group-hover:text-white' : 'text-white'}`}>
                            Get a free quote
                        </span>
                    </button>

                    {/* Mobile Menu Toggle Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-2 -mr-2 rounded-lg transition-colors focus:outline-none"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? (
                            <X className={`w-6 h-6 ${isScrolled || isPartnerships || isMobileMenuOpen ? 'text-black' : 'text-white'}`} />
                        ) : (
                            <Menu className={`w-6 h-6 ${isScrolled || isPartnerships || isMobileMenuOpen ? 'text-black' : 'text-white'}`} />
                        )}
                    </button>
                </div>
            </nav>

            {/* Mobile Dropdown Menu Container */}
            <div
                className={`fixed inset-0 z-40 bg-background/95 backdrop-blur-xl transition-all duration-500 lg:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                style={{ paddingTop: '5.5rem' }}
            >
                <div className="h-full w-full px-6 pb-24 overflow-y-auto flex flex-col gap-6">
                    <div className="flex flex-col gap-2 font-heading text-2xl font-bold tracking-tight">
                        <a href="/#" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">Home</a>
                        <a href="/#services" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">Services</a>
                        <a href="/#process" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">Process</a>
                        <a href="/#gallery" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">Gallery</a>
                        <a href="/#testimonials" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">Testimonials</a>
                        <a href="/#about" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">About</a>
                        <a href="/#faq" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground">FAQ</a>
                        <a href="/partnerships" onClick={() => setIsMobileMenuOpen(false)} className="py-3 border-b border-border/10 text-foreground text-xl">Partnerships & Certifications</a>
                    </div>

                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            setIsMobileMenuOpen(false);
                            window.dispatchEvent(new Event('open-quote'));
                        }}
                        className="bg-primary text-white w-full rounded-full py-4 font-body font-semibold text-lg shadow-md mt-4 sm:hidden block"
                    >
                        Get a free quote
                    </button>

                    <a
                        href="tel:647-966-9108"
                        className="bg-accent text-white w-full rounded-full py-4 font-body font-semibold text-lg shadow-md mt-2 flex items-center justify-center gap-2"
                    >
                        Call (647) 966-9108
                    </a>
                </div>
            </div>
        </>
    );
};

export default Navbar;
