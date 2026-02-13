import ScrollProgress from './components/ui/ScrollProgress';
import Navbar from './components/sections/Navbar';
import Hero from './components/sections/Hero';
import Services from './components/sections/Services';
import WhyPaint from './components/sections/WhyPaint';
import OurProcess from './components/sections/OurProcess';
import BeforeAfter from './components/sections/BeforeAfter';
import Portfolio from './components/sections/Portfolio';
import About from './components/sections/About';
import Testimonials from './components/sections/Testimonials';
import FAQ from './components/sections/FAQ';
import Contact from './components/sections/Contact';
import Footer from './components/sections/Footer';

function App() {
    return (
        <div className="min-h-screen bg-midtown-light">
            {/* Navigation */}
            <Navbar />

            {/* Scroll Progress Indicator */}
            <ScrollProgress />

            {/* Main Sections */}
            <Hero />
            <Services />
            <WhyPaint />
            <OurProcess />
            <BeforeAfter />
            <Portfolio />
            <About />
            <Testimonials />
            <FAQ />
            <Contact />
            <Footer />
        </div>
    );
}

export default App;
