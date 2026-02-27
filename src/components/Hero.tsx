import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const Hero = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef1 = useRef<HTMLHeadingElement>(null);
    const textRef2 = useRef<HTMLHeadingElement>(null);
    const btnRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(
                textRef1.current,
                { y: 40, opacity: 0 },
                { y: 0, opacity: 1, duration: 1, delay: 0.2 }
            )
                .fromTo(
                    textRef2.current,
                    { y: 40, opacity: 0 },
                    { y: 0, opacity: 1, duration: 1 },
                    "-=0.8"
                )
                .fromTo(
                    btnRef.current,
                    { y: 20, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.8 },
                    "-=0.6"
                );
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={containerRef}
            className="relative w-full h-[100dvh] flex flex-col justify-end overflow-hidden pb-10 sm:pb-16 md:pb-24"
        >
            {/* Background Image Setup */}
            <img
                src="/images/hero-new.jpg"
                alt="Beautifully finished Midtown Painting project"
                className="absolute inset-0 z-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
            />
            {/* Heavy Dark Gradient Overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/60 to-black/40" />

            {/* Content Container */}
            <div className="relative z-20 w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-12 flex flex-col gap-4 sm:gap-6">
                <div className="flex flex-col">
                    <h1
                        ref={textRef1}
                        className="text-white font-heading text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight uppercase"
                    >
                        Elevate the
                    </h1>
                    <h2
                        ref={textRef2}
                        className="text-white font-drama text-[3.25rem] sm:text-6xl md:text-8xl lg:text-[10rem] leading-[0.85] -ml-0.5 sm:-ml-1 md:-ml-2 text-primary"
                    >
                        Standard.
                    </h2>
                </div>

                <p className="text-gray-300 font-body max-w-md text-base sm:text-lg md:text-xl font-light">
                    Premium residential painting with zero hassle. Toronto's most trusted painters.
                </p>

                <div className="pt-2 sm:pt-4 flex flex-col items-start gap-3 sm:gap-4">
                    <button
                        ref={btnRef as any}
                        onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('open-quote')); }}
                        className="btn-magnetic items-center justify-center bg-primary text-white px-6 py-3.5 sm:px-8 sm:py-4 rounded-full font-body font-semibold text-base sm:text-lg inline-flex"
                    >
                        <span className="bg-layer bg-black rounded-full"></span>
                        <span className="content-layer">Get a free quote</span>
                    </button>

                    {/* Early Bird Discount Tag */}
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/10 border border-white/20 rounded-full backdrop-blur-sm shadow-md mt-1 sm:mt-2 md:mt-4">
                        <span className="text-[13px] sm:text-[15px] font-body text-white font-medium tracking-wide">
                            Currently offering <strong className="text-[#5cb2ee] font-bold tracking-wider">10% OFF</strong> early bird discount!
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
