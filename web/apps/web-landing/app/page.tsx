import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple';
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import TechStack from '../src/components/sections/TechStack'
import DeveloperIntegration from '../src/components/sections/DeveloperIntegration'
import SafetyReliability from '../src/components/sections/SafetyReliability'
import SupportedModels from '../src/components/sections/SupportedModels'
import CurrentPhase from '../src/components/sections/CurrentPhase'
import EngineeringFAQ from '../src/components/sections/EngineeringFAQ'
export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main style={{ backgroundColor: '#f6f6f4', paddingTop: '80px' }}>
        <Hero />
        <CoreCapabilities />
        <TechStack />
        <DeveloperIntegration />
        <SafetyReliability />
        <SupportedModels />
        <CurrentPhase />
        <EngineeringFAQ />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}