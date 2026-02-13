import React, { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

interface TimelineEntry {
    title: string;
    content: React.ReactNode;
}

interface TimelineProps {
    data: TimelineEntry[];
}

const Timeline: React.FC<TimelineProps> = ({ data }) => {
    const ref = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 40%", "end 60%"],
    });

    const heightTransform = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
    const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

    return (
        <div className="w-full" ref={containerRef}>
            <div ref={ref} className="relative max-w-4xl mx-auto">
                {data.map((item, index) => (
                    <div key={index} className="flex justify-start md:gap-10 pb-16 last:pb-0">
                        {/* Left side: sticky title + dot */}
                        <div className="sticky flex flex-col md:flex-row z-20 items-center top-32 self-start max-w-xs lg:max-w-sm md:w-full">
                            {/* Dot */}
                            <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-midtown-navy flex items-center justify-center shadow-lg">
                                <div className="h-4 w-4 rounded-full bg-midtown-orange" />
                            </div>
                            {/* Title */}
                            <h3 className="hidden md:block text-xl md:pl-20 md:text-2xl font-heading font-bold text-midtown-navy">
                                {item.title}
                            </h3>
                        </div>

                        {/* Right side: content */}
                        <div className="relative pl-20 pr-4 md:pl-4 w-full">
                            <h3 className="md:hidden block text-xl mb-4 text-left font-heading font-bold text-midtown-navy">
                                {item.title}
                            </h3>
                            {item.content}
                        </div>
                    </div>
                ))}

                {/* Timeline beam */}
                <div
                    style={{ height: "100%" }}
                    className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-gradient-to-b from-transparent via-gray-200 to-transparent"
                >
                    <motion.div
                        style={{
                            height: heightTransform,
                            opacity: opacityTransform,
                        }}
                        className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-midtown-orange via-midtown-blue to-transparent rounded-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default Timeline;
