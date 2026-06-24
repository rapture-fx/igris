'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import Pricing from '../../src/components/sections/Pricing'
import { PRICING_SUBTITLE } from '../../src/lib/pricing'
import Faq from '../../src/components/sections/Faq'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import ScrollReveal from '../../src/components/ui/ScrollReveal'

export default function PricingPage() {
  return (
    <div className="igris-grain min-h-screen bg-white text-[#171717] pt-14">
      <Header />
      <main>
        <ScrollReveal>
          <section className="pt-40 pb-10 md:pb-12">
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 text-center">
              <h1
                className="text-[#171717] max-w-lg mx-auto"
                style={{
                  fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                  fontWeight: 600,
                  fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                }}
              >
                Pricing
              </h1>
              <p
                className="mt-5 mx-auto max-w-[52ch] text-[#4d4d4d]"
                style={{
                  fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                  fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
                  lineHeight: 1.6,
                }}
              >
                {PRICING_SUBTITLE}
              </p>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={0.1}><Pricing /></ScrollReveal>

        <ScrollReveal delay={0.1}><Faq large /></ScrollReveal>

        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.1}><ClosingPosition /></ScrollReveal>
        </div>
      </main>
      <Footer />
    </div>
  );
}
