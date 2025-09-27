import Header from '@/components/sections/Header'
import Pricing from '@/components/sections/Pricing'
import Footer from '@/components/sections/Footer'
import { Check, Calculator } from 'lucide-react'

export default function PricingPage() {

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f7f3' }}>
      <Header />
      <main className="pt-36">
        <section className="pb-16 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h1 className="text-2xl md:text-3xl font-normal mb-6" style={{ color: '#1f53d0' }}>
                Pricing that scales with you
              </h1>
            </div>
          </div>

          <Pricing />

        </section>
      </main>
      <Footer />
    </div>
  )
}