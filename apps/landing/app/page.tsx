import Header from '@/components/Header'
import Hero from '@/components/Hero'
import AdditionalFeatures from '@/components/AdditionalFeatures'
import SecurityFeatures from '@/components/SecurityFeatures'
import AudienceGuide from '@/components/AudienceGuide'
import NoCode from '@/components/NoCode'
import Developer from '@/components/Developer'
import Integrations from '@/components/Integrations'
import Benefits from '@/components/Benefits'
import HowItWorks from '@/components/HowItWorks'
import Testimonials from '@/components/Testimonials'
import FAQ from '@/components/FAQ'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <AdditionalFeatures />
        <SecurityFeatures />
        <AudienceGuide />
        <NoCode />
        <Developer />
        <Integrations />
        <Benefits />
        <HowItWorks />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}