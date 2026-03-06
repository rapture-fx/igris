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
          <Pricing />
          <Faq />
          <ClosingPosition />
        </main>
        <Footer />
      </div>
    </div>
  );
}
