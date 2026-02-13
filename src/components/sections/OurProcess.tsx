
import React from 'react';
import { motion } from 'framer-motion';
import Timeline from '../ui/Timeline';

const OurProcess: React.FC = () => {
    const processData = [
        {
            title: "Step 1: Scraping & Sanding",
            content: (
                <div>
                    <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6">
                        Every great paint job starts with proper preparation. We carefully scrape away all
                        loose, peeling, and chipped paint, then sand the surface smooth. This restores the
                        <strong> natural beauty of the wood</strong> and creates the ideal foundation for paint to bond to.
                    </p>
                    <p className="text-gray-500 text-sm mb-6">
                        Skipping this step is the #1 reason paint jobs fail. We never cut corners.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <img
                            src="/images/porch-before.png"
                            alt="Peeling porch steps before painting"
                            className="rounded-xl object-cover h-32 md:h-48 w-full shadow-lg"
                        />
                        <img
                            src="/images/process-deck-before.png"
                            alt="Weathered deck surface before sanding"
                            className="rounded-xl object-cover h-32 md:h-48 w-full shadow-lg"
                        />
                    </div>
                </div>
            ),
        },
        {
            title: "Step 2: Spot Priming",
            content: (
                <div>
                    <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6">
                        After sanding, we apply a high-quality spot primer to all bare wood and
                        problem areas. Primer seals the surface and <strong>protects it from the elements</strong> —
                        rain, sun, freeze-thaw cycles, and humidity that cause rot and decay.
                    </p>
                    <p className="text-gray-500 text-sm mb-6">
                        Proper priming extends the life of your paint job by years.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <img
                            src="/images/project-deck-staining.png"
                            alt="Deck preparation and priming process"
                            className="rounded-xl object-cover h-32 md:h-48 w-full shadow-lg"
                        />
                        <img
                            src="/images/project-fence-deck.png"
                            alt="Fence and deck restoration in progress"
                            className="rounded-xl object-cover h-32 md:h-48 w-full shadow-lg"
                        />
                    </div>
                </div>
            ),
        },
        {
            title: "Step 3: Two Coats of Paint",
            content: (
                <div>
                    <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6">
                        We finish with <strong>two full coats of the highest-quality paint</strong> from
                        <strong> Sherwin-Williams</strong>. Two coats ensures complete, even coverage with
                        vibrant, long-lasting colour that stands up to Canadian weather season after season.
                    </p>
                    <p className="text-gray-500 text-sm mb-6">
                        We never thin our paint or cut it with one coat. Your home deserves the full treatment.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <img
                            src="/images/porch-after.png"
                            alt="Freshly painted porch steps"
                            className="rounded-xl object-cover h-32 md:h-48 w-full shadow-lg"
                        />
                        <img
                            src="/images/deck-stained-after.png"
                            alt="Beautifully stained deck"
                            className="rounded-xl object-cover h-32 md:h-48 w-full shadow-lg"
                        />
                    </div>
                </div>
            ),
        },
    ];

    return (
        <section id="process" className="py-24 bg-white relative overflow-hidden">
            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <span className="text-midtown-orange font-semibold tracking-wider uppercase text-sm">
                        How We Work
                    </span>
                    <h2 className="text-4xl md:text-5xl font-heading font-bold text-midtown-navy mt-3">
                        Our 3-Step Process
                    </h2>
                    <p className="text-gray-600 text-lg mt-4 max-w-2xl mx-auto">
                        Every Midtown project follows a proven process that delivers results
                        that last for years — not months.
                    </p>
                </motion.div>

                {/* Timeline */}
                <Timeline data={processData} />
            </div>
        </section>
    );
};

export default OurProcess;
