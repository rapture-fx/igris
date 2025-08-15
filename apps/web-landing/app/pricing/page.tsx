import Header from '@/components/sections/Header'
import Pricing from '@/components/sections/Pricing'
import FAQ from '@/components/sections/FAQ'
import Footer from '@/components/sections/Footer'
import { Check, Calculator } from 'lucide-react'

export default function PricingPage() {

  return (
    <div className="min-h-screen bg-[#111111]">
      <Header />
      <main className="pt-32">
        <section className="py-16 md:py-24 bg-[#111111]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold text-beige-secondary mb-6">
                Accelerate better with the right plan
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Simple, transparent pricing that scales with your team. Start free and upgrade as you grow.
              </p>
            </div>

            <Pricing />

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gray-50 rounded-lg p-8">
                <div className="flex items-center mb-4">
                  <Calculator className="w-6 h-6 text-[#1A5799] mr-3" />
                  <h3 className="text-xl font-semibold text-beige-secondary">Usage Calculator</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Estimate your monthly API usage based on your data processing needs.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Files processed per month
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Average file size (MB)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g. 10"
                    />
                  </div>
                  <button className="w-full bg-[#1A5799] text-white px-4 py-2 rounded-md hover:bg-[#1e3a8a] transition-colors duration-200">
                    Calculate Usage
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-8">
                <h3 className="text-xl font-semibold text-beige-secondary mb-4">
                  Enterprise Benefits
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-[#10b981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Custom AI model training on your data</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-[#10b981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">On-premise deployment options</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-[#10b981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">24/7 dedicated support team</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-[#10b981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Custom SLA guarantees</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-[#10b981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Advanced security and compliance</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <a
                    href="#contact"
                    className="inline-block bg-[#1A5799] text-white px-6 py-2 rounded-md hover:bg-[#1e3a8a] transition-colors duration-200"
                  >
                    Contact Sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FAQ />
      </main>
      <Footer />
    </div>
  )
}