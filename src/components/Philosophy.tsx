import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LazyImage from './ui/LazyImage';

gsap.registerPlugin(ScrollTrigger);

// A simple utility to split text into word spans for animation
const SplitText = ({ text, className = "" }: { text: string, className?: string }) => {
    return (
        <span className={`inline-block ${className}`}>
            {text.split(" ").map((word, i) => (
                <span key={i} className="inline-block overflow-hidden pb-2 mr-[0.25em]">
                    <span className="word inline-block">{word}</span>
                </span>
            ))}
        </span>
    );
};

const Philosophy = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // 1. Initial state setup
            gsap.set(".word", { y: "150%" });

            // 2. The scroll sequence
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: triggerRef.current,
                    start: "top 60%",
                    end: "bottom 80%",
                    scrub: false,
                    toggleActions: "play none none reverse",
                }
            });

            tl.to(".statement-1 .word", {
                y: "0%",
                duration: 0.8,
                stagger: 0.05,
                ease: "power3.out"
            })
                .to(".statement-2 .word", {
                    y: "0%",
                    duration: 1,
                    stagger: 0.08,
                    ease: "power4.out"
                }, "+=0.2");

        }, sectionRef);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={sectionRef}
            className="relative w-full py-20 sm:py-32 md:py-48 bg-foreground text-[#E8E4DD] overflow-hidden"
        >
            {/* Background Texture Overlay */}
            <LazyImage
                src="/images/rotting-wood.jpg"
                alt="Subtle wood grain texture"
                containerClassName="absolute inset-0 z-0 transform-gpu"
                className="h-full w-full object-cover opacity-[0.03] mix-blend-overlay grayscale transform-gpu [backface-visibility:hidden]"
                sizes="100vw"
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 relative z-10" ref={triggerRef}>

                {/* Contrast Statement 1 */}
                <div className="statement-1 mb-6 sm:mb-8 opacity-60">
                    <p className="font-body text-base sm:text-xl md:text-2xl tracking-tight">
                        <SplitText text="Most contractors focus on: speed, compromise, and cutting corners." />
                    </p>
                </div>

                {/* Contrast Statement 2 (The Manifesto hook) */}
                <div className="statement-2 max-w-5xl">
                    <p className="font-heading font-bold text-[1.75rem] sm:text-4xl md:text-6xl lg:text-7xl leading-[1.1] tracking-tight">
                        <SplitText text="We focus on:" />
                        <br />
                        <SplitText text="flawless execution and" />
                        <br />
                        <span className="text-accent pr-2">
                            <SplitText text="absolute" className="font-drama text-accent" />
                        </span>
                        <SplitText text="precision." />
                    </p>
                </div>

            </div>
        </section>
    );
};

export default Philosophy;
