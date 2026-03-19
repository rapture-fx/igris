import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import Pricing from '../../src/components/sections/Pricing'
import Faq from '../../src/components/sections/Faq'
import ClosingPosition from '../../src/components/sections/ClosingPosition'

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0A0A0A]">
      <div className="relative z-10">
        <Header />
        <main>
          {/* Hero Section */}
          <section className="pt-40 pb-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-[1100px] mx-auto text-center">
              <h1 className="text-xl md:text-3xl lg:text-4xl mb-4 text-[#000000] dark:text-[#f6f6f4] max-w-lg mx-auto" style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}>
                Deploy autonomous systems with verifiable execution.
              </h1>
              
            </div>
          </section>

          <Pricing />
          
          <Faq />
          <ClosingPosition />
        </main>
        <Footer />
      </div>
    </div>
  );
}
