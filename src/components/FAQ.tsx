import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const faqs = [
    {
        question: "How does the estimate process work?",
        answer: "Carter and you will have a consultation call at a time that works best for you both. The point of this phone call is for you to give us a clear picture of your project, and then arrange a time for Carter to come by if we are the right fit for your project!"
    },
    {
        question: "What happens during the estimate?",
        answer: "Once we arrange a time that works for both homeowners, Carter will come by and look at all the areas of work with you. He will explain the process the crews will follow to effectively complete the project. Once everything is clear, he will take his measurements, then take about 20 minutes to write up the estimate. Finally, we present the quote to you and come to an agreement!"
    },
    {
        question: "What kind of paint do you use?",
        answer: "We strictly use premium deluxe paints, including Sherwin-Williams and other top-tier options to guarantee a flawless finish."
    },
    {
        question: "What's the deal with the 10% off?",
        answer: "The ten percent discount is offered if you choose to move forward on the day of the estimate. It's an incentive we offer because of how busy we are throughout this time of year!"
    },
    {
        question: "Are you guys insured and have warranty?",
        answer: "Yes, we are fully insured. We carry $5 million in liability insurance and provide comprehensive WSIB coverage to give you complete peace of mind and protect your home."
    }
];

const FAQ = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".faq-reveal", {
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

    const toggleOpen = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section id="faq" ref={sectionRef} className="py-16 sm:py-24 md:py-32 bg-background w-full overflow-hidden border-t border-black/10">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col gap-8 sm:gap-12">
                <div className="faq-reveal text-center">
                    <span className="font-data text-primary text-xs sm:text-sm uppercase tracking-widest font-bold">
                        Frequently Asked Questions
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mt-3 sm:mt-4 leading-[1.1] text-foreground">
                        Everything you need to know
                    </h2>
                </div>

                <div className="flex flex-col gap-3 sm:gap-4 mt-4 sm:mt-8">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;

                        return (
                            <div
                                key={index}
                                className="faq-reveal bg-card border border-black/10 rounded-[1.25rem] sm:rounded-[2rem] overflow-hidden hover-lift transition-shadow duration-300 hover:shadow-lg"
                            >
                                <button
                                    onClick={() => toggleOpen(index)}
                                    className="w-full text-left px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 flex justify-between items-center bg-transparent focus:outline-none cursor-pointer"
                                    aria-expanded={isOpen}
                                >
                                    <span className="font-heading font-bold text-lg sm:text-xl md:text-2xl text-foreground pr-4 sm:pr-8">
                                        {faq.question}
                                    </span>
                                    <motion.div
                                        animate={{ rotate: isOpen ? 45 : 0 }}
                                        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                        className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/5 flex items-center justify-center text-primary"
                                    >
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </motion.div>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-5 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 pt-0 font-body text-base sm:text-lg text-gray-700 leading-relaxed">
                                                <div className="pt-4 border-t border-black/5">
                                                    {faq.answer}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default FAQ;
