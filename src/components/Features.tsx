import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LazyImage from './ui/LazyImage';

gsap.registerPlugin(ScrollTrigger);

const FeatureImage = ({ imagePath, alt }: { imagePath: string; alt: string }) => {
    return (
        <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-gray-200">
            <LazyImage
                src={imagePath}
                alt={alt}
                containerClassName="absolute inset-0"
                className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-105"
                sizes="(min-width: 768px) 30vw, 90vw"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-500" />
        </div>
    );
};

const Features = () => {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".feature-card", {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 75%",
                },
                y: 60,
                opacity: 0,
                stagger: 0.15,
                duration: 1,
                ease: "power3.out"
            });
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    return (
        <section ref={sectionRef} id="services" className="py-20 sm:py-32 md:py-48 bg-background relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-10 sm:mb-16">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">
                        Built on <span className="font-drama text-accent">Precision</span>.
                    </h2>
                    <p className="mt-3 sm:mt-4 text-base sm:text-lg font-body text-gray-600 max-w-2xl">
                        We operate differently. Every project is executed as a systematic protocol to ensure flawless results and absolute reliability.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">

                    {/* Card 1 */}
                    <div className="feature-card group flex flex-col gap-4 sm:gap-6 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-white border border-border shadow-xs hover:shadow-md hover:border-accent/30 transition-shadow">
                        <FeatureImage imagePath="/images/feature-unmatched.png" alt="Painter rolling interior wall paint" />
                        <div>
                            <h3 className="text-xl sm:text-2xl font-bold font-heading mb-2">Unmatched Experience</h3>
                            <p className="font-body text-gray-600 text-sm leading-relaxed">
                                Carter has taken on 70+ projects, elevating homes across Leaside, Bennington, Rosedale, Moore Park, Lawrence Park, and many other lovely neighbourhoods in the GTA.
                            </p>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="feature-card group flex flex-col gap-4 sm:gap-6 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-white border border-border shadow-xs hover:shadow-md hover:border-accent/30 transition-shadow">
                        <FeatureImage imagePath="/images/team.png" alt="Midtown Painting team posing together" />
                        <div>
                            <h3 className="text-xl sm:text-2xl font-bold font-heading mb-2">Building a Legacy</h3>
                            <p className="font-body text-gray-600 text-sm leading-relaxed">
                                With 4 years in the business, Carter and his team are driven by reputation. We stand by our work and will stop at nothing until you are completely satisfied with the results.
                            </p>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="feature-card group flex flex-col gap-4 sm:gap-6 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-white border border-border shadow-xs hover:shadow-md hover:border-accent/30 transition-shadow">
                        <FeatureImage imagePath="/images/feature-flawless.png" alt="Close-up of flawless painted trim" />
                        <div>
                            <h3 className="text-xl sm:text-2xl font-bold font-heading mb-2">Flawless Finishes</h3>
                            <p className="font-body text-gray-600 text-sm leading-relaxed">
                                Using premium products and precise application techniques, we deliver a striking, uniform finish designed to endure the test of time perfectly.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default Features;
