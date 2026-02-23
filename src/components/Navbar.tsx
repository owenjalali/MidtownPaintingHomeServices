import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Navbar = () => {
    const navRef = useRef<HTMLElement>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const location = useLocation();

    const isPartnerships = location.pathname === '/partnerships';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav
            ref={navRef}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl rounded-[2rem] px-6 py-4 transition-all duration-500 flex items-center justify-between ${isScrolled
                ? 'glass-nav text-black shadow-sm'
                : isPartnerships ? 'bg-transparent text-black drop-shadow-none' : 'bg-transparent text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]'
                }`}
        >
            <div className="flex items-center gap-3">
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

            <div>
                <button
                    onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('open-quote')); }}
                    className="btn-magnetic px-6 py-3 rounded-full text-sm font-semibold border border-current hover:border-transparent group"
                >
                    <span className="bg-layer rounded-full"></span>
                    <span className={`content-layer transition-colors duration-300 ${isScrolled || isPartnerships ? 'text-black group-hover:text-white' : 'text-white'}`}>
                        Get a free quote
                    </span>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
