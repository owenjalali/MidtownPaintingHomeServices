
import React from 'react';
import { motion } from 'framer-motion';
import FAQAccordion from '../ui/FAQAccordion';

const faqItems = [
    {
        id: 'insurance',
        question: 'Do you have insurance?',
        answer: 'Yes! We carry $5 Million in liability insurance, one of the highest coverages in the GTA. This protects you, your property, and our team in the unlikely event of any issues.',
    },
    {
        id: 'wsib',
        question: 'What is your warranty and are you WSIB covered?',
        answer: 'Absolutely. We are fully WSIB (Workplace Safety and Insurance Board) covered. This means you are protected from any liability if an accident occurs on your property. Our work also comes with a satisfaction guarantee - we are not done until you are happy.',
    },
    {
        id: 'areas',
        question: 'What areas do you serve?',
        answer: 'We proudly serve the entire Greater Toronto Area (GTA) including Toronto, Mississauga, North York, Etobicoke, Scarborough, Markham, Vaughan, Richmond Hill, and surrounding areas.',
    },
    {
        id: 'quote',
        question: 'How do I get a quote?',
        answer: 'Getting a quote is easy! Simply fill out our contact form below, call us at (647) 966-9108, or send us an email. We will schedule a free on-site estimate at a time that works for you. No obligation, no pressure.',
    },
    {
        id: 'discount',
        question: 'What is the 10% discount about?',
        answer: 'We offer a 10% discount when you book your project on the same day as your quote! It is our way of saying thank you for making a quick decision. This applies to all residential and commercial projects.',
    },
    {
        id: 'timeline',
        question: 'How long will my project take?',
        answer: 'Project timelines vary based on scope and size. A single room typically takes 1-2 days, while a full home interior may take 4-7 days. We will provide a detailed timeline during your free estimate.',
    },
];

const FAQ: React.FC = () => {
    return (
        <section id="faq" className="py-20 lg:py-32 bg-gradient-to-br from-midtown-light to-white">
            <div className="container mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
                    {/* Left Column - Header */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="lg:sticky lg:top-32"
                    >
                        <span className="text-midtown-orange font-semibold text-sm uppercase tracking-wider">
                            FAQ
                        </span>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-midtown-navy mt-4 mb-6">
                            Questions? We Have Got Answers
                        </h2>
                        <p className="text-gray-600 text-lg mb-8">
                            Here are some common questions we receive. Cannot find what you are looking for?
                            Reach out and we will be happy to help!
                        </p>

                        {/* Contact prompt */}
                        <div className="p-6 bg-midtown-navy rounded-2xl text-white">
                            <h3 className="font-heading font-bold text-xl mb-2">Still have questions?</h3>
                            <p className="text-midtown-blue mb-4">We are here to help!</p>
                            <a
                                href="tel:+16479669108"
                                className="inline-block px-6 py-3 bg-midtown-orange rounded-full font-semibold hover:bg-midtown-orange/90 transition-colors"
                            >
                                Call (647) 966-9108
                            </a>
                        </div>
                    </motion.div>

                    {/* Right Column - Accordion */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <FAQAccordion items={faqItems} />
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default FAQ;
