import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

type Tab = 'interior' | 'exterior' | 'wood';

// Helper to generate image arrays
const generateImages = (prefix: string, count: number) => {
    return Array.from({ length: count }, (_, i) => ({
        src: `/images/gallery/${prefix}/${prefix}-${i + 1}.png`,
        alt: `${prefix} work ${i + 1}`
    }));
};

const galleryData = {
    interior: {
        title: "Interior Transformations",
        desc: "Something to beautify your home with. Impeccable lines, smooth finishes.",
        images: generateImages('interior', 8)
    },
    exterior: {
        title: "Exterior Fortification",
        desc: "Protecting your asset while maximizing curb appeal.",
        images: generateImages('exterior', 17)
    },
    wood: {
        title: "Wood Staining",
        desc: "Staining to beautify wood and to give it that natural glow. Protect your home from wood rot and bring natural beauty back to life.",
        images: generateImages('wood', 8)
    }
};

const getSpanForIndex = (index: number) => {
    // Return a repeating pattern of spans for variety
    const pattern = [
        'col-span-2 row-span-2 md:col-span-2',
        'col-span-1 row-span-1',
        'col-span-1 row-span-1',
        'col-span-2 row-span-1 md:col-span-2'
    ];
    return pattern[index % pattern.length];
};

const Gallery = () => {
    const [activeTab, setActiveTab] = useState<Tab>('interior');

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const activeImages = galleryData[activeTab].images;

    const openLightbox = (index: number) => {
        setCurrentImageIndex(index);
        setLightboxOpen(true);
        // Prevent scrolling when lightbox is open
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        setLightboxOpen(false);
        // Restore scrolling
        document.body.style.overflow = 'unset';
    };

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % activeImages.length);
    };

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + activeImages.length) % activeImages.length);
    };

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!lightboxOpen) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxOpen, activeImages.length]);

    // Ensure lightbox closes when tab changes
    useEffect(() => {
        if (lightboxOpen) closeLightbox();
    }, [activeTab]);

    return (
        <section id="gallery" className="py-32 md:py-48 bg-background w-full">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-heading font-bold text-foreground">
                            Verification.
                        </h2>
                        <p className="mt-2 text-lg font-body text-gray-600">
                            The output of our methodology. Pick a discipline:
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-full border border-gray-200 overflow-x-auto whitespace-nowrap">
                        {(['interior', 'exterior', 'wood'] as Tab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-full font-body font-semibold text-sm transition-all duration-300 ${activeTab === tab ? 'bg-white shadow-sm text-foreground' : 'text-gray-500 hover:text-foreground'}`}
                            >
                                {tab === 'interior' && 'Interior'}
                                {tab === 'exterior' && 'Exterior'}
                                {tab === 'wood' && 'Wood Staining'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="mb-8 transition-opacity duration-300">
                    <h3 className="text-2xl font-bold font-heading text-primary">{galleryData[activeTab].title}</h3>
                    <p className="text-gray-600 font-body text-lg max-w-2xl">{galleryData[activeTab].desc}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[250px] transition-all duration-500">
                    {activeImages.map((img, i) => (
                        <div
                            key={`${activeTab}-${img.src}`}
                            onClick={() => openLightbox(i)}
                            className={`relative rounded-3xl overflow-hidden group cursor-pointer bg-gray-200 animate-fade-in ${getSpanForIndex(i)}`}
                            style={{ animationDelay: `${(i % 8) * 50}ms` }}
                        >
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-105"
                                style={{ backgroundImage: `url('${img.src}')` }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-500 flex items-center justify-center">
                                <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Lightbox Modal */}
            {lightboxOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity duration-300" onClick={closeLightbox}>
                    <button
                        onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                        className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all z-50"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    <button
                        onClick={prevImage}
                        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-all z-50"
                    >
                        <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                    </button>

                    <button
                        onClick={nextImage}
                        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-all z-50"
                    >
                        <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                    </button>

                    <div className="relative w-full max-w-5xl h-[80vh] flex items-center justify-center p-4">
                        <img
                            src={activeImages[currentImageIndex].src}
                            alt={activeImages[currentImageIndex].alt}
                            className="max-w-full max-h-full object-contain drop-shadow-2xl select-none"
                            onClick={(e) => e.stopPropagation()} // Prevent click through to background
                        />
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 font-data text-sm tracking-widest bg-black/50 px-4 py-2 rounded-full">
                        {currentImageIndex + 1} / {activeImages.length}
                    </div>
                </div>
            )}
        </section>
    );
};

export default Gallery;
