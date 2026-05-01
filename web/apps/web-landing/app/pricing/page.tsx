'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import Pricing from '../../src/components/sections/Pricing'
import Faq from '../../src/components/sections/Faq'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import ScrollReveal from '../../src/components/ui/ScrollReveal'

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#1b1912]">
      <div className="relative z-10">
        <Header />
        <main>
          <ScrollReveal>
            <section className="pt-40 pb-6 px-4 sm:px-6 lg:px-8">
              <div className="max-w-[1100px] mx-auto text-center">
                <h1 className="text-xl md:text-3xl lg:text-4xl mb-4 text-[#000000] dark:text-[#f6f6f4] max-w-lg mx-auto" style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}>
                  Pricing
                </h1>
                
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}><Pricing /></ScrollReveal>
          
          <ScrollReveal delay={0.1}><Faq /></ScrollReveal>
          <ScrollReveal delay={0.1}><ClosingPosition /></ScrollReveal>
        </main>
        <Footer />
      </div>
    </div>
  );
}
