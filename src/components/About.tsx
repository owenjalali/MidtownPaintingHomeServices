import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const About = () => {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".about-reveal", {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 75%",
                },
                y: 40,
                opacity: 0,
                stagger: 0.15,
                duration: 1,
                ease: "power3.out"
            });
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    return (
        <section id="about" ref={sectionRef} className="py-16 sm:py-24 md:py-32 bg-background w-full overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col md:flex-row gap-10 sm:gap-16 lg:gap-24 items-center">

                {/* Image Section - Focus entirely on Carter */}
                <div className="w-full md:w-5/12 about-reveal relative">
                    <div className="relative aspect-[4/5] rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl max-w-sm mx-auto md:max-w-none">
                        <img
                            src="/images/carter.png"
                            alt="Carter Jenkins - Owner of Midtown Painting"
                            className="absolute inset-0 w-full h-full object-cover grayscale contrast-[1.1]"
                            loading="lazy"
                            decoding="async"
                            sizes="(min-width: 768px) 38vw, 92vw"
                        />
                        {/* Premium Brutalist Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent mix-blend-multiply" />
                    </div>
                </div>

                {/* Content Section */}
                <div className="w-full md:w-7/12 flex flex-col gap-6 sm:gap-8">
                    <div className="about-reveal">
                        <span className="font-data text-primary text-xs sm:text-sm uppercase tracking-widest font-bold">
                            Meet the Owner
                        </span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mt-3 sm:mt-4 leading-[1.1] text-foreground">
                            Carter Jenkins
                        </h2>
                    </div>

                    <div className="font-body text-base sm:text-lg text-gray-700 leading-relaxed space-y-4 sm:space-y-6 about-reveal">
                        <p>
                            Hi, my name is Carter Jenkins, a second-year Economics student at McGill University. With four years in the painting industry and three running my own business, I'm passionate about entrepreneurship and helping homeowners completely transform their spaces.
                        </p>
                        <p>
                            My experience at St. Michael's College School—as a student ambassador, prefect, and Varsity hockey player—instilled the rigorous discipline and strong work ethic I bring to every project. Last summer, our returning team completed 70+ projects with a perfect 5-star rating. This year, my goal is to exceed 130+ projects while maintaining our uncompromising standards of quality and sheer professionalism.
                        </p>
                        <p>
                            Supported by the Student Works Management Program, my team and I strictly employ high-quality materials to deliver flawless, lasting finishes. Your satisfaction is not just a goal; it's our absolute priority.
                        </p>
                    </div>

                    {/* Contact Block */}
                    <div className="pt-6 sm:pt-8 border-t border-black/10 flex flex-col sm:flex-row gap-6 sm:gap-8 about-reveal">
                        <div>
                            <p className="font-data text-xs text-gray-400 uppercase tracking-widest mb-1">Direct Line</p>
                            <a href="tel:647-966-9108" className="font-body text-lg sm:text-xl font-medium text-foreground hover:text-primary transition-colors hover-lift inline-block">
                                647-966-9108
                            </a>
                        </div>
                        <div>
                            <p className="font-data text-xs text-gray-400 uppercase tracking-widest mb-1">Email</p>
                            <a href="mailto:carterjenkins91@gmail.com" className="font-body text-lg sm:text-xl font-medium text-foreground hover:text-primary transition-colors hover-lift inline-block break-all sm:break-normal">
                                carterjenkins91@gmail.com
                            </a>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default About;
