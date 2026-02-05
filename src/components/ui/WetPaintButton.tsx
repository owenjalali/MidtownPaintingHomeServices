import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WetPaintButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: 'primary' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
}

const variantColors = {
    primary: {
        bg: 'bg-midtown-orange',
        hover: 'hover:brightness-110',
        fill: 'fill-midtown-orange',
    },
    secondary: {
        bg: 'bg-midtown-navy',
        hover: 'hover:brightness-110',
        fill: 'fill-midtown-navy',
    },
};

const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
};

const WetPaintButton: React.FC<WetPaintButtonProps> = ({
    children,
    onClick,
    className,
    variant = 'primary',
    size = 'md',
}) => {
    const colors = variantColors[variant];

    return (
        <button
            onClick={onClick}
            className={cn(
                "group relative rounded-full font-semibold font-heading text-white transition-all overflow-visible",
                sizeClasses[size],
                colors.bg,
                colors.hover,
                className
            )}
        >
            {children}
            <Drip left="10%" height={24} delay={0.5} bgClass={colors.bg} fillClass={colors.fill} />
            <Drip left="30%" height={20} delay={3} bgClass={colors.bg} fillClass={colors.fill} />
            <Drip left="57%" height={10} delay={4.25} bgClass={colors.bg} fillClass={colors.fill} />
            <Drip left="85%" height={16} delay={1.5} bgClass={colors.bg} fillClass={colors.fill} />
        </button>
    );
};

type DripProps = {
    left: string;
    height: number;
    delay: number;
    bgClass: string;
    fillClass: string;
};

const Drip: React.FC<DripProps> = ({ left, height, delay, bgClass, fillClass }) => {
    return (
        <motion.div
            className="absolute top-[99%] origin-top"
            style={{ left }}
            initial={{ scaleY: 0.75 }}
            animate={{ scaleY: [0.75, 1, 0.75] }}
            transition={{
                duration: 2,
                times: [0, 0.25, 1],
                delay,
                ease: "easeIn",
                repeat: Infinity,
                repeatDelay: 2,
            }}
        >
            {/* The main body of the drip */}
            <div
                style={{ height }}
                className={cn("w-2 rounded-b-full transition-colors", bgClass)}
            />

            {/* SVG for the right-side curve of the drip */}
            <svg
                width="6"
                height="6"
                viewBox="0 0 6 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-full top-0"
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.4 0H0V5.4C0 2.41765 2.41766 0 5.4 0Z"
                    className={cn("transition-colors", fillClass)}
                />
            </svg>

            {/* SVG for the left-side curve of the drip */}
            <svg
                width="6"
                height="6"
                viewBox="0 0 6 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute right-full top-0 rotate-90"
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.4 0H0V5.4C0 2.41765 2.41766 0 5.4 0Z"
                    className={cn("transition-colors", fillClass)}
                />
            </svg>

            {/* A smaller, detached droplet that falls */}
            <motion.div
                initial={{ y: -8, opacity: 1 }}
                animate={{ y: [-8, 50], opacity: [1, 0] }}
                transition={{
                    duration: 2,
                    times: [0, 1],
                    delay,
                    ease: "easeIn",
                    repeat: Infinity,
                    repeatDelay: 2,
                }}
                className={cn("absolute top-full h-2 w-2 rounded-full transition-colors", bgClass)}
            />
        </motion.div>
    );
};

export default WetPaintButton;
