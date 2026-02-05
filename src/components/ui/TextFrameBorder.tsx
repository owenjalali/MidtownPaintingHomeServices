
import React from 'react';

interface TextFrameBorderProps {
    imageSrc: string;
    text?: string;
    size?: number;
    className?: string;
}

const TextFrameBorder: React.FC<TextFrameBorderProps> = ({
    imageSrc,
    text = '✦ QUALITY ✦ TRUSTED ✦ PROFESSIONAL ✦ QUALITY ✦ TRUSTED ✦ PROFESSIONAL ',
    size = 300,
    className = '',
}) => {
    const blobPath = "M43.1,-68.5C56.2,-58.6,67.5,-47.3,72.3,-33.9C77.2,-20.5,75.5,-4.9,74.2,11.3C72.9,27.6,71.9,44.5,63.8,57.2C55.7,69.8,40.6,78.2,25.5,79.2C10.4,80.1,-4.7,73.6,-20.9,69.6C-37.1,65.5,-54.5,63.9,-66,54.8C-77.5,45.8,-83.2,29.3,-85.7,12.3C-88.3,-4.8,-87.7,-22.3,-79.6,-34.8C-71.5,-47.3,-55.8,-54.9,-41.3,-64.2C-26.7,-73.6,-13.4,-84.7,0.8,-86C15,-87.2,29.9,-78.5,43.1,-68.5Z";

    return (
        <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
            <svg
                viewBox="0 0 200 200"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
                style={{ overflow: 'visible' }}
            >
                <defs>
                    {/* Clip path for the blob shape */}
                    <clipPath id="blobClip">
                        <path d={blobPath} transform="translate(100 100)" />
                    </clipPath>
                </defs>

                {/* Image inside blob */}
                <image
                    href={imageSrc}
                    width="200"
                    height="200"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#blobClip)"
                    className="transition-transform duration-300"
                />

                {/* Blob outline with gradient */}
                <path
                    d={blobPath}
                    transform="translate(100 100)"
                    fill="none"
                    stroke="url(#blobGradient)"
                    strokeWidth="2"
                    className="opacity-50"
                />

                {/* Gradient for blob outline */}
                <defs>
                    <linearGradient id="blobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1a365d" />
                        <stop offset="50%" stopColor="#6b9dcd" />
                        <stop offset="100%" stopColor="#e8a63a" />
                    </linearGradient>
                </defs>

                {/* Text path (invisible, just for text positioning) */}
                <path
                    id="textPath"
                    d={blobPath}
                    transform="translate(100 100)"
                    fill="none"
                    stroke="none"
                />

                {/* Rotating text around the blob */}
                <text className="fill-midtown-navy text-[8px] font-bold uppercase tracking-[2px]">
                    <textPath href="#textPath" startOffset="0%">
                        {text}
                        <animate
                            attributeName="startOffset"
                            from="0%"
                            to="100%"
                            dur="20s"
                            repeatCount="indefinite"
                        />
                    </textPath>
                    <textPath href="#textPath" startOffset="-100%">
                        {text}
                        <animate
                            attributeName="startOffset"
                            from="-100%"
                            to="0%"
                            dur="20s"
                            repeatCount="indefinite"
                        />
                    </textPath>
                </text>
            </svg>
        </div>
    );
};

export default TextFrameBorder;
