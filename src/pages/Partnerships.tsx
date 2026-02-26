import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Partnerships = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            <section className="pt-32 pb-24 md:pt-48 md:pb-32 bg-background min-h-screen">
                <div className="max-w-4xl mx-auto px-6 lg:px-12 flex flex-col gap-16">
                    <div className="text-center">
                        <span className="font-data text-primary text-sm uppercase tracking-widest font-bold">
                            Credentials & Quality
                        </span>
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mt-4 leading-[1.1] text-foreground">
                            Partnerships & Certifications
                        </h1>
                        <p className="mt-6 text-lg font-body text-gray-600 max-w-2xl mx-auto">
                            We align ourselves with the industry's best paints, safety boards, and community organizations. Building relationships defined by quality and giving back.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* WSIB */}
                        <div className="bg-card border border-black/10 rounded-[2rem] p-8 flex flex-col gap-6 hover:shadow-lg transition-shadow duration-300">
                            <div className="h-24 flex items-center justify-start">
                                <img src="/images/certifications/wsib.png" alt="WSIB Ontario Certified" className="h-full object-contain max-w-[200px]" loading="lazy" decoding="async" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold font-heading mb-3">WSIB Certified</h3>
                                <p className="font-body text-gray-600 text-sm leading-relaxed">
                                    Midtown Painting Home Services is fully covered and in good standing with the Workplace Safety and Insurance Board (WSIB) of Ontario. This provides comprehensive coverage and ensures peace of mind for both our crew and our homeowners on every single project.
                                </p>
                            </div>
                        </div>

                        {/* MS Society */}
                        <div className="bg-card border border-black/10 rounded-[2rem] p-8 flex flex-col gap-6 hover:shadow-lg transition-shadow duration-300">
                            <div className="h-24 flex items-center justify-start">
                                <img src="/images/certifications/ms-society.png" alt="MS Society of Canada" className="h-full object-contain max-w-[200px]" loading="lazy" decoding="async" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold font-heading mb-3">MS Society of Canada</h3>
                                <p className="font-body text-gray-600 text-sm leading-relaxed">
                                    We believe in building more than just beautiful homes. A portion of our sales is proudly donated to the Multiple Sclerosis Society of Canada, directly supporting the fight against MS and funding pivotal research to help the community.
                                </p>
                            </div>
                        </div>

                        {/* Sherwin Williams */}
                        <div className="bg-card border border-black/10 rounded-[2rem] p-8 flex flex-col gap-6 hover:shadow-lg transition-shadow duration-300">
                            <div className="h-24 flex items-center justify-start">
                                <img src="/images/certifications/sherwin-williams.png" alt="Sherwin Williams" className="h-full object-contain max-w-[200px]" loading="lazy" decoding="async" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold font-heading mb-3">Sherwin-Williams</h3>
                                <p className="font-body text-gray-600 text-sm leading-relaxed">
                                    We exclusively utilize top-tier paints to guarantee a flawless finish that endures over time. Our direct partnership with Sherwin-Williams allows us to source premium materials engineered for incredible durability and color vibrancy.
                                </p>
                            </div>
                        </div>

                        {/* Dulux */}
                        <div className="bg-card border border-black/10 rounded-[2rem] p-8 flex flex-col gap-6 hover:shadow-lg transition-shadow duration-300">
                            <div className="h-24 flex items-center justify-start">
                                <img src="/images/certifications/dulux.png" alt="Dulux Paints" className="h-full object-contain max-w-[200px]" loading="lazy" decoding="async" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold font-heading mb-3">Dulux Paints</h3>
                                <p className="font-body text-gray-600 text-sm leading-relaxed">
                                    Partnering with Dulux Canada enables us to access industry-leading color pallets and highly resilient finishes. By combining expert techniques with high-end Dulux coatings, we ensure lasting value for all exterior and interior jobs.
                                </p>
                            </div>
                        </div>

                        {/* Benson Kearley */}
                        <div className="bg-card border border-black/10 rounded-[2rem] p-8 flex flex-col gap-6 hover:shadow-lg transition-shadow duration-300 md:col-span-1 lg:col-span-2 max-w-2xl mx-auto w-full">
                            <div className="h-24 flex items-center justify-start">
                                <img src="/images/certifications/benson-kearley.png" alt="Benson Kearley IFG" className="h-full object-contain max-w-[200px]" loading="lazy" decoding="async" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold font-heading mb-3">Benson Kearley IFG</h3>
                                <p className="font-body text-gray-600 text-sm leading-relaxed">
                                    We are proud to partner with Benson Kearley IFG, ensuring our business operations and comprehensive coverage are handled by industry leaders, giving our clients total peace of mind and protection on every job.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
};

export default Partnerships;
