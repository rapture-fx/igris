import Header from '@/components/sections/Header'
import Pricing from '@/components/sections/Pricing'
import FAQ from '@/components/sections/FAQ'
import Footer from '@/components/sections/Footer'
import { Check, Calculator } from 'lucide-react'

export default function PricingPage() {

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-32">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-base font-semibold leading-7 text-[#1A5799] text-center">Pricing</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Simplifies complex data handling
              </h1>
              
            </div>

            <Pricing />

            
          </div>
        </section>

        <FAQ />
      </main>
      <Footer />
    </div>
  )
}