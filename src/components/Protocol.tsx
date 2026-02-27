import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LazyImage from './ui/LazyImage';

gsap.registerPlugin(ScrollTrigger);

const protocols = [
    {
        step: "01",
        title: "Initial Assessment",
        desc: "A meticulous site walkthrough. We measure, analyze the substrate conditions, and detail every requirement.",
        color: "bg-[#F5F3EE]",
        textMode: "text-[#111111]",
        image: "/images/process-1.jpg"
    },
    {
        step: "02",
        title: "Surface Conditioning",
        desc: "Rigorous preparation sequence. Sanding, deglossing, patching, and premium priming to ensure an indestructible bond.",
        color: "bg-[#E8E4DD]",
        textMode: "text-[#111111]",
        image: "/images/process-2.jpg"
    },
    {
        step: "03",
        title: "Application Protocol",
        desc: "Strategic application of premium coatings. Sharp lines, perfect coverage, and a flawless texture consistency.",
        color: "bg-foreground",
        textMode: "text-[#E8E4DD]",
        image: "/images/process-3.jpg"
    }
];

const Protocol = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Only apply complex pinning on non-mobile devices 
        // to avoid erratic scroll behavior on phones
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;

        if (!isDesktop) return;

        const ctx = gsap.context(() => {
            const cards = gsap.utils.toArray<HTMLElement>('.protocol-card');

            cards.forEach((card, i) => {
                if (i === cards.length - 1) return; // don't pin the last one

                ScrollTrigger.create({
                    trigger: card,
                    start: "top top",
                    pin: true,
                    pinSpacing: false,
                    endTrigger: containerRef.current,
                    end: "bottom bottom",
                });

                // The scaling and blurring effect as the next card comes up
                const nextCard = cards[i + 1];
                if (nextCard) {
                    gsap.to(card, {
                        scale: 0.9,
                        opacity: 0.4,
                        filter: "blur(10px)",
                        ease: "none",
                        scrollTrigger: {
                            trigger: nextCard,
                            start: "top bottom",
                            end: "top top",
                            scrub: true,
                        }
                    });
                }
            });
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section id="process" ref={containerRef} className="relative w-full bg-foreground">
            {protocols.map((p, i) => (
                <div
                    key={i}
                    className={`protocol-card sticky top-0 h-[100dvh] w-full flex flex-col justify-center items-center px-4 sm:px-6 ${p.color} ${p.textMode} rounded-b-[2rem] sm:rounded-b-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] origin-top z-[${10 + i}] border-b border-black/10 overflow-hidden relative`}
                >
                    {/* Background Image heavily dimmed to strictly serve as texture */}
                    <LazyImage
                        src={p.image}
                        alt={`${p.title} background texture`}
                        containerClassName="absolute inset-0 z-0"
                        className="h-full w-full object-cover transition-transform duration-[10s] ease-out scale-105 opacity-20"
                        sizes="100vw"
                    />

                    <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col justify-center items-center text-center">
                        {/* Content */}
                        <div className="flex flex-col gap-4 sm:gap-6 items-center">
                            <h2 className="font-heading text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight">
                                {p.step}. {p.title}
                            </h2>
                            <p className="font-body text-base sm:text-xl md:text-3xl max-w-2xl font-light opacity-90 border-t-2 border-accent pt-4 sm:pt-6 mt-1 sm:mt-2">
                                {p.desc}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </section>
    );
};

export default Protocol;
