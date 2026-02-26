import React, { useEffect, useRef, useState } from 'react';

type LazyImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'loading'> & {
    containerClassName?: string;
    loading?: 'lazy' | 'eager';
    rootMargin?: string;
};

const LazyImage = ({
    src,
    alt = '',
    className,
    containerClassName,
    loading = 'lazy',
    decoding = 'async',
    rootMargin = '300px',
    ...imgProps
}: LazyImageProps) => {
    const shouldLoadImmediately = loading === 'eager';
    const [shouldLoad, setShouldLoad] = useState(shouldLoadImmediately);
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (shouldLoadImmediately || shouldLoad) {
            return;
        }

        const node = containerRef.current;
        if (!node || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
            setShouldLoad(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            { root: null, rootMargin, threshold: 0.01 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [rootMargin, shouldLoad, shouldLoadImmediately]);

    return (
        <span ref={containerRef} className={containerClassName}>
            {shouldLoad ? (
                <img
                    src={src}
                    alt={alt}
                    className={className}
                    loading={loading}
                    decoding={decoding}
                    {...imgProps}
                />
            ) : null}
        </span>
    );
};

export default LazyImage;
