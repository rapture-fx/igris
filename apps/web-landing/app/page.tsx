import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero'
import AdditionalFeatures from '../src/components/sections/AdditionalFeatures'
import SecurityFeatures from '../src/components/sections/SecurityFeatures'
import AudienceGuide from '../src/components/sections/AudienceGuide'
import NoCode from '../src/components/sections/NoCode'
import Developer from '../src/components/sections/Developer'
import Integrations from '../src/components/sections/Integrations'
import Benefits from '../src/components/sections/Benefits'
import HowItWorks from '../src/components/sections/HowItWorks'
import Testimonials from '../src/components/sections/Testimonials'
import FAQ from '../src/components/sections/FAQ'
import Footer from '../src/components/sections/Footer'
import GridBackground from '../src/components/ui/GridBackground'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main>
        <Hero />
        <GridBackground />
        <Benefits />
        <HowItWorks />
        <AudienceGuide />
        <NoCode />
        <Developer />
        <AdditionalFeatures />
        <SecurityFeatures />
        <Integrations />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}