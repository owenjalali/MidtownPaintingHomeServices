import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const faqs = [
    {
        question: "How does the estimate process work?",
        answer: "Carter will basically give you a call. We'll discuss the scope of the project and the logistics of the work."
    },
    {
        question: "What happens during the estimate?",
        answer: "We'll find a time where we can meet with both of the homeowners. Both of the homeowners must be present. The whole quote process should just take about 15 to 30 minutes. We walk around, explain what we're doing, take measurements, and then write up and present the quote to you."
    },
    {
        question: "What kind of paint do you use?",
        answer: "We strictly use premium deluxe paints, including Sherwin-Williams and other top-tier options to guarantee a flawless finish."
    },
    {
        question: "What's the deal with that 10% off?",
        answer: "The 10% off is an exclusive discount reserved for homeowners who book with us exactly on the same day of the estimate."
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
        <section id="faq" ref={sectionRef} className="py-24 md:py-32 bg-background w-full overflow-hidden border-t border-black/10">
            <div className="max-w-4xl mx-auto px-6 lg:px-12 flex flex-col gap-12">
                <div className="faq-reveal text-center">
                    <span className="font-data text-primary text-sm uppercase tracking-widest font-bold">
                        Frequently Asked Questions
                    </span>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mt-4 leading-[1.1] text-foreground">
                        Everything you need to know
                    </h2>
                </div>

                <div className="flex flex-col gap-4 mt-8">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;

                        return (
                            <div
                                key={index}
                                className="faq-reveal bg-card border border-black/10 rounded-[2rem] overflow-hidden hover-lift transition-shadow duration-300 hover:shadow-lg"
                            >
                                <button
                                    onClick={() => toggleOpen(index)}
                                    className="w-full text-left px-6 py-6 lg:px-8 lg:py-8 flex justify-between items-center bg-transparent focus:outline-none cursor-pointer"
                                    aria-expanded={isOpen}
                                >
                                    <span className="font-heading font-bold text-xl md:text-2xl text-foreground pr-8">
                                        {faq.question}
                                    </span>
                                    <motion.div
                                        animate={{ rotate: isOpen ? 45 : 0 }}
                                        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                        className="flex-shrink-0 w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-primary"
                                    >
                                        <Plus className="w-5 h-5" />
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
                                            <div className="px-6 pb-6 lg:px-8 lg:pb-8 pt-0 font-body text-lg text-gray-700 leading-relaxed">
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
