import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
    {
        quote: "A really nice job on both the inside and outside projects.",
        author: "Heather Kavanaugh",
        location: "Toronto"
    },
    {
        quote: "The crew was knowledgeable, provided good feedback, respectful, and had great work ethic. They did a great job. I am very happy with the end result and would highly recommend them to others.",
        author: "Ramaneek Gill",
        location: "Toronto"
    },
    {
        quote: "I was very pleased with both painters assigned to the job. Lovely people and very personable. They went above and beyond to take care of everything, and they did an excellent job. Everything looks beautiful. Carter was great to deal with from start to finish. He is an excellent manager.",
        author: "Leslie Howard",
        location: "Toronto"
    },
    {
        quote: "I highly recommend StudentWorks. They were very friendly, respectful, and worked very hard throughout the day. The project was completed in the full day and the completed work was of high quality. I will not hesitate to contact them again for future painting or other jobs.",
        author: "Helen Poulos",
        location: "Toronto"
    },
    {
        quote: "Excellent. Sean and Ethan were very courteous and did a great job cleaning our deck. I would highly recommend them.",
        author: "Ann Bondy",
        location: "Toronto"
    },
    {
        quote: "Excellent and diligent work. The team performed incredibly well, were very professional, and finished in a great amount of time.",
        author: "Jerry Thomas",
        location: "East York (Toronto)"
    }
];

const Testimonials = () => {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".testimonial-card", {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 80%",
                },
                y: 50,
                opacity: 0,
                stagger: 0.1,
                duration: 0.8,
                ease: "power3.out"
            });
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    return (
        <section id="testimonials" ref={sectionRef} className="py-20 sm:py-32 md:py-48 bg-[#020617] text-paper w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">

                <div className="mb-10 sm:mb-16 md:mb-24 flex flex-col items-center text-center">
                    <span className="font-data text-accent text-xs sm:text-sm uppercase tracking-widest font-bold mb-3 sm:mb-4">
                        Client Verification
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-heading font-bold text-white max-w-3xl">
                        Tested by <span className="font-drama text-primary italic">Toronto</span>.
                    </h2>
                </div>

                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
                    {testimonials.map((t, i) => (
                        <div
                            key={i}
                            className="testimonial-card break-inside-avoid bg-[#0f172a] border border-white/5 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] hover:border-accent/40 transition-colors shadow-2xl"
                        >
                            <div className="flex text-accent mb-4 sm:mb-6">
                                {[...Array(5)].map((_, j) => (
                                    <svg key={j} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                ))}
                            </div>
                            <p className="font-drama text-xl sm:text-2xl leading-snug text-white/90 mb-6 sm:mb-8 italic">
                                "{t.quote}"
                            </p>
                            <div className="flex flex-col">
                                <span className="font-heading font-bold text-base sm:text-lg text-white">{t.author}</span>
                                <span className="font-data text-xs text-gray-500 uppercase tracking-widest">{t.location}</span>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};

export default Testimonials;
