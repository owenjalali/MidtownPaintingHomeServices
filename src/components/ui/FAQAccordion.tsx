
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
    id: string;
    question: string;
    answer: string;
}

interface FAQAccordionProps {
    items: FAQItem[];
    className?: string;
}

const FAQAccordion: React.FC<FAQAccordionProps> = ({ items, className = '' }) => {
    const [openId, setOpenId] = useState<string | null>(null);

    const toggleItem = (id: string) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {items.map((item) => (
                <motion.div
                    key={item.id}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                    initial={false}
                >
                    <button
                        onClick={() => toggleItem(item.id)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                    >
                        <span className="font-heading font-semibold text-midtown-navy text-lg pr-4">
                            {item.question}
                        </span>
                        <motion.div
                            animate={{ rotate: openId === item.id ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex-shrink-0"
                        >
                            <ChevronDown className="w-5 h-5 text-midtown-orange" />
                        </motion.div>
                    </button>

                    <AnimatePresence mode="wait">
                        {openId === item.id && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                            >
                                <div className="px-5 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                                    {item.answer}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            ))}
        </div>
    );
};

export default FAQAccordion;
