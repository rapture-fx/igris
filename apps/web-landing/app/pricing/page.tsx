import Header from '@/components/sections/Header'
import Pricing from '@/components/sections/Pricing'
import Footer from '@/components/sections/Footer'
import { Check, Calculator } from 'lucide-react'

export default function PricingPage() {

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f7f3' }}>
      <Header />
      <main className="pt-32">
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: '#1f53d0' }}>
                Data workflows that scale with you
              </h1>
              <p className="text-center text-gray-600 mb-8 text-lg">The essentials for secure, scalable data pipelines are built into every plan</p>
            </div>
          </div>

          <Pricing />

        </section>
      </main>
      <Footer />
    </div>
  )
}