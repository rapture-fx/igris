import Header from '../src/components/sections/Header'
import AudienceTabs from '../src/components/sections/AudienceTabs'
import Hero from '../src/components/sections/Hero';
import CardSection from '../src/components/sections/CardSection';
import AdditionalFeatures from '../src/components/sections/AdditionalFeatures'
import SecurityFeatures from '../src/components/sections/SecurityFeatures'
import AudienceGuide from '../src/components/sections/AudienceGuide'
import Integrations from '../src/components/sections/Integrations'
import Benefits from '../src/components/sections/Benefits'
import HowItWorks from '../src/components/sections/HowItWorks'
import LatestUpdate from '../src/components/sections/LatestUpdate'
import FAQ from '../src/components/sections/FAQ'
import Footer from '../src/components/sections/Footer'
import GridBackground from '@/components/ui/GridBackground'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <CardSection />
        <Benefits />
        <HowItWorks />
        <AudienceTabs />
        <AdditionalFeatures />
        <SecurityFeatures />
        <Integrations />
        <LatestUpdate />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}