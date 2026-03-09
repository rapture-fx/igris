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
          <section className="pt-12 pb-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-[1100px] mx-auto text-center">
              <h1 className="text-3xl md:text-5xl lg:text-6xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Deploy autonomous systems with verifiable execution.
              </h1>
              <p className="text-lg text-gray-600 dark:text-[#a8a898] max-w-2xl mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Igris provides the runtime layer for AI agents, edge systems, and robotics workloads.
              </p>
              <div className="mt-6 p-4 bg-gray-50 dark:bg-[#1b1912] rounded-lg max-w-2xl mx-auto">
                <p className="text-sm text-gray-700 dark:text-[#c8c8b8]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  A runtime instance is a deployed Igris runtime running on a server, edge device, robot, or agent host.
                </p>
              </div>
            </div>
          </section>

          <Pricing />
          
          {/* Runtime Definition */}
          <section className="py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-[1100px] mx-auto text-center">
              <p className="text-sm text-gray-600 dark:text-[#a8a898]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Runtime instances represent independently deployed Igris runtimes. Each instance enforces execution safety, policy constraints, and verifiable receipts.
              </p>
            </div>
          </section>

          <Faq />
          <ClosingPosition />
        </main>
        <Footer />
      </div>
    </div>
  );
}
