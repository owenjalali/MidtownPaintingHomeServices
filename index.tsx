import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

// --- Icons (SVGs) ---
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>
);
const ChevronDownIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
);
const PaintRollerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="6" x="2" y="2" rx="2"/><path d="M10 8v2"/><path d="M10 10v10"/><path d="M14 10v4a2 2 0 0 0 2 2h4"/></svg>
);
const ShieldCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
);
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const ZoomIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);

// --- Components ---

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "About", href: "#about" },
    { name: "Why Us", href: "#why-us" },
    { name: "Portfolio", href: "#portfolio" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm py-4" : "bg-transparent py-6"}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <a href="#" className="flex items-center gap-3 group">
          <img 
            src="https://static.wixstatic.com/media/698c7e_3add6c5f04bd4644bb0076be8515f87a~mv2.png/v1/crop/x_48,y_48,w_400,h_400/fill/w_67,h_67,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/698c7e_3add6c5f04bd4644bb0076be8515f87a~mv2.png" 
            alt="Midtown Painting Logo" 
            className="h-10 w-10 md:h-12 md:w-12 rounded-full border border-stone-200 shadow-sm group-hover:shadow-md transition-shadow"
          />
          <span className="text-xl md:text-2xl font-semibold tracking-tight font-serif text-stone-900 group-hover:text-stone-700 transition-colors">
            Midtown Painting
          </span>
        </a>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">
              {link.name}
            </a>
          ))}
          <a href="#contact" className="bg-stone-900 text-white px-5 py-2.5 text-sm font-medium rounded-sm hover:bg-stone-700 transition-colors">
            Get a Quote
          </a>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-stone-900" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <XIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-stone-100 py-6 px-6 flex flex-col space-y-4 shadow-lg animate-fade-in-down">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="text-lg font-medium text-stone-800" onClick={() => setIsOpen(false)}>
              {link.name}
            </a>
          ))}
          <a href="#contact" className="block text-center bg-stone-900 text-white px-5 py-3 text-lg font-medium rounded-sm" onClick={() => setIsOpen(false)}>
            Get a Quote
          </a>
        </div>
      )}
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://static.wixstatic.com/media/698c7e_240534f4138f4de0b11a3fccc3a97463f001.jpg/v1/fill/w_1920,h_442,al_c,q_85,enc_avif,quality_auto/698c7e_240534f4138f4de0b11a3fccc3a97463f001.jpg" 
          alt="Beautifully painted interior" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-stone-900/40"></div>
      </div>

      <div className="relative z-10 text-center text-white max-w-4xl px-6">
        <p className="text-sm md:text-base tracking-[0.2em] uppercase mb-4 opacity-90 shadow-sm">Serving the GTA Area</p>
        <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 leading-tight drop-shadow-lg">
          Transform Your Home <br /> With Precision
        </h1>
        <p className="text-lg md:text-xl font-light max-w-2xl mx-auto mb-10 text-stone-100 drop-shadow-md">
          Midtown Painting & Home Services brings 50+ projects of experience to your doorstep. Minimalist. Professional. Beautiful.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#contact" className="bg-white text-stone-900 px-8 py-3.5 text-sm md:text-base font-semibold rounded-sm hover:bg-stone-100 transition-colors shadow-lg">
            Book an Appointment
          </a>
          <a href="#portfolio" className="border border-white text-white px-8 py-3.5 text-sm md:text-base font-semibold rounded-sm hover:bg-white/10 transition-colors shadow-lg backdrop-blur-sm">
            View Our Work
          </a>
        </div>
      </div>
    </section>
  );
};

const WhyUs = () => {
  const features = [
    {
      icon: <HomeIcon />,
      title: "Elevate Your Space",
      description: "A fresh coat of paint isn't just color; it's a mood. We help you curate a space that feels calm, modern, and uniquely yours."
    },
    {
      icon: <ShieldCheckIcon />,
      title: "Protect Your Investment",
      description: "Our premium materials protect your home's exterior from the elements and your interior from wear and tear, ensuring longevity."
    },
    {
      icon: <PaintRollerIcon />,
      title: "Meticulous Detail",
      description: "We don't just paint walls; we perfect them. From prep to the final stroke, our attention to detail is obsessive."
    }
  ];

  return (
    <section id="why-us" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-stone-900 mb-4">Why Paint With Us?</h2>
          <p className="text-stone-500 max-w-2xl mx-auto">
            Your home is your sanctuary. We treat it with the respect it deserves, delivering results that stand the test of time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {features.map((feature, idx) => (
            <div key={idx} className="flex flex-col items-center text-center p-6 border border-stone-100 rounded-lg hover:shadow-lg transition-shadow duration-300">
              <div className="mb-6 text-stone-800 p-4 bg-stone-50 rounded-full">
                {feature.icon}
              </div>
              <h3 className="text-xl font-medium mb-3 font-serif">{feature.title}</h3>
              <p className="text-stone-600 leading-relaxed text-sm md:text-base">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const About = () => {
  return (
    <section id="about" className="py-24 bg-stone-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2 relative">
             <div className="absolute -top-4 -left-4 w-full h-full border-2 border-stone-300 rounded-sm"></div>
             <img 
               src="https://static.wixstatic.com/media/nsplsh_6d376654364f72655a6649~mv2_d_2848_4272_s_4_2.jpg/v1/fill/w_1920,h_526,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/nsplsh_6d376654364f72655a6649~mv2_d_2848_4272_s_4_2.jpg" 
               alt="Artistic wall painting" 
               className="relative w-full h-[500px] object-cover rounded-sm shadow-xl grayscale hover:grayscale-0 transition-all duration-700"
             />
          </div>
          <div className="md:w-1/2">
            <h4 className="text-sm font-bold tracking-widest text-stone-500 mb-2 uppercase">The Founder</h4>
            <h2 className="text-4xl md:text-5xl font-serif font-semibold text-stone-900 mb-6">Carter Jenkins</h2>
            <div className="space-y-6 text-stone-700 leading-relaxed">
              <p>
                Carter had a love for paint ever since he was a little kid. While others were drawing with crayons, Carter was fascinated by how a simple change in color could completely transform a room.
              </p>
              <p>
                Now, as the aspiring painter and CEO behind Midtown Painting & Home Services, he has turned that childhood passion into a profession.
              </p>
              <p>
                Having successfully taken on <strong>50+ projects in the GTA area</strong>, Carter brings a personal touch to every job. He believes that painting is more than a service—it's an art form that requires patience, precision, and a deep respect for the homeowner's vision.
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-stone-200">
              <p className="font-serif italic text-xl text-stone-800">"We don't just cover walls; we uncover the beauty of your home."</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Portfolio = () => {
  // Enhanced data with provided images
  const projects = [
    { url: "https://static.wixstatic.com/media/698c7e_7f9932c8bb264206ba78a80a4fc4daf9~mv2.png/v1/fit/w_480,h_362,q_90,enc_avif,quality_auto/698c7e_7f9932c8bb264206ba78a80a4fc4daf9~mv2.png", title: "High Park Soffits (After)", category: "Exterior" },
    { url: "https://static.wixstatic.com/media/698c7e_43fb08c4961b45f7b6729140ee64a673~mv2.png/v1/fit/w_480,h_362,q_90,enc_avif,quality_auto/698c7e_43fb08c4961b45f7b6729140ee64a673~mv2.png", title: "High Park Soffits (Before)", category: "Exterior" },
    { url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2653&auto=format&fit=crop", title: "Modern Minimalist Living", category: "Interior" },
    { url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2670&auto=format&fit=crop", title: "Forest Hill Exterior", category: "Exterior" },
    { url: "https://images.unsplash.com/photo-1556912173-3db9963abf3b?q=80&w=2670&auto=format&fit=crop", title: "Scandi Kitchen Refresh", category: "Cabinetry" },
    { url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2669&auto=format&fit=crop", title: "Mid-Century Restoration", category: "Interior" },
    { url: "https://images.unsplash.com/photo-1628744876497-eb30460be9f6?q=80&w=2670&auto=format&fit=crop", title: "Downtown Condo", category: "Commercial" },
    { url: "https://images.unsplash.com/photo-1595514020180-8c24f4129f71?q=80&w=2670&auto=format&fit=crop", title: "Lakeside Deck Staining", category: "Exterior" },
    { url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?q=80&w=2670&auto=format&fit=crop", title: "High Park Living Room", category: "Interior" },
  ];

  const categories = ["All", "Interior", "Exterior", "Commercial", "Cabinetry"];
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filter logic
  const filteredProjects = projects.filter(
    (p) => activeCategory === "All" || p.category === activeCategory
  );

  // Lightbox navigation handlers
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    document.body.style.overflow = "hidden"; // Prevent scrolling
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    document.body.style.overflow = "auto";
  };

  const nextImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxIndex !== null) {
      setLightboxIndex((prev) => (prev! + 1) % filteredProjects.length);
    }
  }, [lightboxIndex, filteredProjects.length]);

  const prevImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxIndex !== null) {
      setLightboxIndex((prev) => (prev! - 1 + filteredProjects.length) % filteredProjects.length);
    }
  }, [lightboxIndex, filteredProjects.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, nextImage, prevImage]);

  return (
    <section id="portfolio" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12 flex flex-col items-center text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-stone-900 mb-4">Before & After Gallery</h2>
          <p className="text-stone-500 max-w-2xl">
            Explore our diverse portfolio of transformations. Use the filters below to view specific categories of our work.
          </p>
        </div>

        {/* Categories Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                activeCategory === category
                  ? "bg-stone-900 text-white shadow-md"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project, idx) => (
            <div 
              key={`${project.title}-${idx}`} 
              className="group cursor-pointer relative overflow-hidden rounded-sm bg-stone-100 shadow-sm hover:shadow-xl transition-shadow duration-300"
              onClick={() => openLightbox(idx)}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src={project.url} 
                  alt={project.title} 
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out"
                />
              </div>
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                 <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white">
                      <ZoomIcon />
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-white border-t border-stone-50">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">{project.category}</p>
                <h3 className="text-lg font-medium font-serif text-stone-900">{project.title}</h3>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <a href="#contact" className="inline-block border-b-2 border-stone-900 pb-1 text-stone-900 font-medium hover:text-stone-600 hover:border-stone-600 transition-colors">
            Start Your Own Transformation &rarr;
          </a>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          {/* Close Button */}
          <button 
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-[70]"
          >
            <XIcon />
          </button>

          {/* Navigation Buttons */}
          <button 
            onClick={prevImage}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
          >
            <ChevronLeftIcon />
          </button>
          
          <button 
            onClick={nextImage}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
          >
            <ChevronRightIcon />
          </button>

          {/* Image Content */}
          <div className="max-w-5xl w-full max-h-[85vh] relative flex flex-col items-center">
            <img 
              src={filteredProjects[lightboxIndex].url} 
              alt={filteredProjects[lightboxIndex].title} 
              className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-sm"
            />
            <div className="mt-6 text-center">
              <h3 className="text-2xl font-serif text-white mb-1">
                {filteredProjects[lightboxIndex].title}
              </h3>
              <p className="text-stone-400 uppercase tracking-widest text-sm">
                {filteredProjects[lightboxIndex].category}
              </p>
            </div>
            
            {/* Counter */}
            <div className="absolute top-0 left-0 bg-black/50 px-3 py-1 text-white text-xs rounded-br-sm font-mono">
              {lightboxIndex + 1} / {filteredProjects.length}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const FAQ = () => {
  const faqs = [
    {
      q: "How long does a typical project take?",
      a: "Timelines vary based on size and scope. A standard bedroom may take 1-2 days, while a full exterior could take 1-2 weeks. We provide a detailed schedule with every quote."
    },
    {
      q: "What kind of paint do you use?",
      a: "We exclusively use premium, low-VOC paints from trusted brands like Benjamin Moore and Sherwin-Williams to ensure durability and a flawless finish that is safe for your family."
    },
    {
      q: "Do I need to move my furniture?",
      a: "We ask that you move small fragile items. For larger furniture, our team will carefully move and cover everything to protect your belongings before we begin."
    },
    {
      q: "Is your work insured?",
      a: "Absolutely. Midtown Painting & Home Services is fully insured and covered, giving you complete peace of mind throughout the project."
    }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-stone-100">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-center text-stone-900 mb-12">Frequently Asked Questions</h2>
        
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-stone-50 transition-colors"
              >
                <span className="font-medium text-stone-900 text-lg">{faq.q}</span>
                <ChevronDownIcon className={`transform transition-transform duration-300 text-stone-400 ${openIndex === idx ? 'rotate-180' : ''}`} />
              </button>
              <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openIndex === idx ? 'max-h-48 py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
                <p className="text-stone-600 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Booking = () => {
  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16">
          
          {/* Contact Info */}
          <div>
            <h2 className="text-4xl md:text-5xl font-serif font-semibold text-stone-900 mb-6">Let's create something beautiful.</h2>
            <p className="text-lg text-stone-600 mb-12 leading-relaxed">
              Ready to transform your home? Fill out the form, and Carter or a member of the team will get back to you within 24 hours to schedule your free consultation.
            </p>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-stone-900 mb-1">Service Area</h4>
                <p className="text-stone-600">Greater Toronto Area (GTA) & Surrounding Regions</p>
              </div>
              <div>
                <h4 className="font-bold text-stone-900 mb-1">Email</h4>
                <a href="mailto:hello@midtownpainting.ca" className="text-stone-600 hover:text-stone-900 transition-colors">hello@midtownpainting.ca</a>
              </div>
              <div>
                <h4 className="font-bold text-stone-900 mb-1">Phone</h4>
                <p className="text-stone-600">(555) 123-4567</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-stone-50 p-8 md:p-10 rounded-xl shadow-inner border border-stone-100">
            <h3 className="text-2xl font-serif font-medium mb-6">Book an Appointment</h3>
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-stone-500 tracking-wider">First Name</label>
                  <input type="text" className="w-full bg-white border border-stone-200 rounded-sm px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-500 transition-colors" placeholder="Jane" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-stone-500 tracking-wider">Last Name</label>
                  <input type="text" className="w-full bg-white border border-stone-200 rounded-sm px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-500 transition-colors" placeholder="Doe" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-stone-500 tracking-wider">Email Address</label>
                <input type="email" className="w-full bg-white border border-stone-200 rounded-sm px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-500 transition-colors" placeholder="jane@example.com" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-stone-500 tracking-wider">Service Type</label>
                <select className="w-full bg-white border border-stone-200 rounded-sm px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-500 transition-colors appearance-none">
                  <option>Interior Painting</option>
                  <option>Exterior Painting</option>
                  <option>Cabinet Refinishing</option>
                  <option>Commercial Services</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-stone-500 tracking-wider">Message</label>
                <textarea rows={4} className="w-full bg-white border border-stone-200 rounded-sm px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-500 transition-colors" placeholder="Tell us about your project..."></textarea>
              </div>

              <button className="w-full bg-stone-900 text-white font-bold py-4 rounded-sm hover:bg-stone-800 transition-all transform hover:-translate-y-0.5 shadow-md">
                Request Consultation
              </button>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-stone-900 text-stone-400 py-16 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <h3 className="text-2xl font-serif text-white mb-4">Midtown Painting</h3>
          <p className="max-w-sm text-sm leading-relaxed mb-6">
            Providing premium painting and home services to the Greater Toronto Area. Dedicated to quality, integrity, and your vision.
          </p>
          <div className="flex space-x-4">
             {/* Social Placeholders */}
             <div className="w-8 h-8 bg-stone-800 rounded-full hover:bg-stone-700 cursor-pointer flex items-center justify-center transition-colors">
               <span className="text-xs">IG</span>
             </div>
             <div className="w-8 h-8 bg-stone-800 rounded-full hover:bg-stone-700 cursor-pointer flex items-center justify-center transition-colors">
               <span className="text-xs">FB</span>
             </div>
          </div>
        </div>
        
        <div>
          <h4 className="text-white font-bold uppercase tracking-wider text-xs mb-6">Navigation</h4>
          <ul className="space-y-3 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
            <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
            <li><a href="#why-us" className="hover:text-white transition-colors">Why Us</a></li>
            <li><a href="#portfolio" className="hover:text-white transition-colors">Portfolio</a></li>
            <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold uppercase tracking-wider text-xs mb-6">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li>(555) 123-4567</li>
            <li>hello@midtownpainting.ca</li>
            <li>Toronto, ON</li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-stone-800 text-xs flex flex-col md:flex-row justify-between items-center">
        <p>&copy; {new Date().getFullYear()} Midtown Painting & Home Services. All rights reserved.</p>
        <p className="mt-2 md:mt-0">Designed with precision.</p>
      </div>
    </footer>
  );
};

// --- Main App ---

const App = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <WhyUs />
      <Portfolio />
      <About />
      <FAQ />
      <Booking />
      <Footer />
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
