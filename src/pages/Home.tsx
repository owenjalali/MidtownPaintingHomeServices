import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Philosophy from '../components/Philosophy';
import Protocol from '../components/Protocol';
import Gallery from '../components/Gallery';
import Testimonials from '../components/Testimonials';
import About from '../components/About';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';

const Home = () => {
    useEffect(() => {
        const handleLoad = () => {
            // @ts-ignore
            if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        };
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
    }, []);

    return (
        <>
            <Hero />
            <Features />
            <Philosophy />
            <Protocol />
            <Gallery />
            <Testimonials />
            <About />
            <FAQ />
            <Footer />
        </>
    );
};

export default Home;
