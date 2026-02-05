import React from 'react';
import { motion } from 'framer-motion';

interface LivingWatercolorProps {
    children?: React.ReactNode;
    className?: string;
    colors?: string[];
}

const LivingWatercolor: React.FC<LivingWatercolorProps> = ({
    children,
    className = '',
    colors = ['#1a365d', '#6b9dcd', '#e8a63a'],
}) => {
    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* SVG Filter for watercolor bleed effect */}
            <svg className="absolute w-0 h-0" aria-hidden="true">
                <defs>
                    <filter id="watercolor-bleed" x="-50%" y="-50%" width="200%" height="200%">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.015"
                            numOctaves="3"
                            seed="42"
                            result="noise"
                        />
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="noise"
                            scale="30"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>
                </defs>
            </svg>

            {/* Animated paint splotches */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Large splotch - top right */}
                <motion.div
                    className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-30"
                    style={{
                        background: `radial-gradient(ellipse at center, ${colors[1]}80, ${colors[0]}40, transparent 70%)`,
                        filter: 'url(#watercolor-bleed) blur(20px)',
                    }}
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, 0],
                        x: [0, 20, 0],
                        y: [0, -10, 0],
                    }}
                    transition={{
                        duration: 12,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Medium splotch - bottom left */}
                <motion.div
                    className="absolute -bottom-32 -left-20 w-[400px] h-[400px] rounded-full opacity-40"
                    style={{
                        background: `radial-gradient(ellipse at center, ${colors[2]}70, ${colors[1]}30, transparent 70%)`,
                        filter: 'url(#watercolor-bleed) blur(15px)',
                    }}
                    animate={{
                        scale: [1, 1.15, 1],
                        rotate: [0, -8, 0],
                        x: [0, 15, 0],
                        y: [0, 20, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2,
                    }}
                />

                {/* Small accent splotch - center */}
                <motion.div
                    className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full opacity-20"
                    style={{
                        background: `radial-gradient(ellipse at center, ${colors[0]}60, ${colors[2]}20, transparent 60%)`,
                        filter: 'url(#watercolor-bleed) blur(25px)',
                    }}
                    animate={{
                        scale: [0.9, 1.1, 0.9],
                        rotate: [0, 10, 0],
                    }}
                    transition={{
                        duration: 18,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 4,
                    }}
                />

                {/* Extra small accent - top left */}
                <motion.div
                    className="absolute top-10 left-10 w-[200px] h-[200px] rounded-full opacity-25"
                    style={{
                        background: `radial-gradient(ellipse at center, ${colors[2]}50, transparent 60%)`,
                        filter: 'blur(30px)',
                    }}
                    animate={{
                        scale: [1, 1.2, 1],
                        y: [0, 30, 0],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1,
                    }}
                />
            </div>

            {/* Content */}
            <div className="relative z-10">{children}</div>
        </div>
    );
};

export default LivingWatercolor;
