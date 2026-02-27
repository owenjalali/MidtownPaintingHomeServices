import React from 'react';

const Footer = () => {
    return (
        <footer className="relative bg-[#111111] text-[#E8E4DD] rounded-t-[2.5rem] sm:rounded-t-[4rem] pt-16 sm:pt-24 pb-8 px-4 sm:px-6 lg:px-12 mt-8 sm:mt-12 overflow-hidden">

            {/* Massive CTA Space */}
            <div id="contact" className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center mb-16 sm:mb-32 border-b border-white/10 pb-16 sm:pb-24">
                <h2 className="font-heading text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 sm:mb-8">
                    Ready to <span className="font-drama text-primary italic">Initiate?</span>
                </h2>
                <p className="font-body text-base sm:text-xl text-gray-400 max-w-2xl mb-8 sm:mb-12 font-light">
                    Bypass the friction. Experience premium residential painting executed with absolute precision and zero hassle.
                </p>

                <button
                    onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('open-quote')); }}
                    className="btn-magnetic bg-primary text-white px-8 py-4 sm:px-10 sm:py-5 rounded-full font-body font-semibold text-lg sm:text-xl inline-flex shadow-[0_0_40px_rgba(234,88,12,0.3)]"
                >
                    <span className="bg-layer bg-white rounded-full"></span>
                    <span className="content-layer group-hover:text-primary">Get a free quote</span>
                </button>
            </div>

            {/* Standard Footer Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-12 sm:mb-16">

                {/* Brand & Status */}
                <div className="col-span-2 flex flex-col justify-between">
                    <div>
                        <span className="font-heading font-bold text-xl sm:text-2xl tracking-tight block mb-2">Midtown Painting Home Services</span>
                        <span className="font-body text-sm text-gray-500">Premium residential painting.</span>
                    </div>

                    <div className="mt-8 sm:mt-12 flex flex-col gap-2">
                        <span className="font-body font-bold text-sm uppercase tracking-widest opacity-50 text-white">Contact</span>
                        <a href="mailto:carterjenkins91@gmail.com" className="font-data text-sm text-gray-400 hover:text-primary transition-colors break-all sm:break-normal">
                            carterjenkins91@gmail.com
                        </a>
                        <a href="tel:647-966-9108" className="font-data text-sm text-gray-400 hover:text-primary transition-colors">
                            647-966-9108
                        </a>
                    </div>
                </div>

                {/* Links */}
                <div>
                    <h4 className="font-body font-bold mb-3 sm:mb-4 text-sm uppercase tracking-widest opacity-50">Navigation</h4>
                    <ul className="flex flex-col gap-3 font-body text-sm text-gray-300">
                        <li><a href="#services" className="hover:text-primary transition-colors">Services</a></li>
                        <li><a href="#process" className="hover:text-primary transition-colors">Protocol</a></li>
                        <li><a href="#gallery" className="hover:text-primary transition-colors">Verification</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-body font-bold mb-3 sm:mb-4 text-sm uppercase tracking-widest opacity-50">Legal</h4>
                    <ul className="flex flex-col gap-3 font-body text-sm text-gray-300">
                        <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                        <li className="flex items-center gap-2 mt-4 text-xs opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                            Fully Insured & WSIB Covered
                        </li>
                    </ul>
                </div>

            </div>
        </footer>
    );
};

export default Footer;
