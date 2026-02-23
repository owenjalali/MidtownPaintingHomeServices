import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FeatureImage = ({ imagePath }: { imagePath: string }) => {
    return (
        <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-gray-200">
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-105"
                style={{ backgroundImage: `url('${imagePath}')` }}
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
        <section ref={sectionRef} id="services" className="py-32 md:py-48 bg-background relative z-10">
            <div className="max-w-7xl mx-auto">
                <div className="mb-16">
                    <h2 className="text-4xl md:text-5xl font-heading font-bold text-foreground">
                        Built on <span className="font-drama text-accent">Precision</span>.
                    </h2>
                    <p className="mt-4 text-lg font-body text-gray-600 max-w-2xl">
                        We operate differently. Every project is executed as a systematic protocol to ensure flawless results and absolute reliability.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Card 1 */}
                    <div className="feature-card group flex flex-col gap-6 p-8 rounded-[2rem] bg-white border border-border shadow-xs hover:shadow-md hover:border-accent/30 transition-shadow">
                        <FeatureImage imagePath="/images/feature-unmatched.png" />
                        <div>
                            <h3 className="text-2xl font-bold font-heading mb-2">Unmatched Experience</h3>
                            <p className="font-body text-gray-600 text-sm leading-relaxed">
                                Carter has taken on 70+ projects, elevating homes across Leaside, Bennington, Rosedale, Moore Park, Lawrence, and many other premium neighbourhoods across the GTA.
                            </p>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="feature-card group flex flex-col gap-6 p-8 rounded-[2rem] bg-white border border-border shadow-xs hover:shadow-md hover:border-accent/30 transition-shadow">
                        <FeatureImage imagePath="/images/team.png" />
                        <div>
                            <h3 className="text-2xl font-bold font-heading mb-2">Building a Legacy</h3>
                            <p className="font-body text-gray-600 text-sm leading-relaxed">
                                With 4 years in the business, Carter and his team are driven by reputation. We stand by our work and will stop at nothing until you are completely satisfied with the results.
                            </p>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="feature-card group flex flex-col gap-6 p-8 rounded-[2rem] bg-white border border-border shadow-xs hover:shadow-md hover:border-accent/30 transition-shadow">
                        <FeatureImage imagePath="/images/feature-flawless.png" />
                        <div>
                            <h3 className="text-2xl font-bold font-heading mb-2">Flawless Finishes</h3>
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
