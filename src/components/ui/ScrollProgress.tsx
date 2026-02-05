
import React, { useEffect, useState } from 'react';

const ScrollProgress: React.FC = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            setProgress(scrollPercent);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gray-200/50">
            <div
                className="h-full bg-gradient-to-r from-midtown-navy via-midtown-blue to-midtown-orange transition-all duration-75"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
};

export default ScrollProgress;
