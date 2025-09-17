import WorksOutOfTheBox from '../src/components/sections/WorksOutOfTheBox';
import BuiltForEngineers from '../src/components/sections/BuiltForEngineers';
import Header from '../src/components/sections/Header'
import AudienceTabs from '../src/components/sections/AudienceTabs'
import Hero from '../src/components/sections/Hero';
import CardSection from '../src/components/sections/CardSection';
import AdditionalFeatures from '../src/components/sections/AdditionalFeatures'
import SecurityFeatures from '../src/components/sections/SecurityFeatures'
import SecuritySection from '../src/components/sections/SecuritySection'
import AudienceGuide from '../src/components/sections/AudienceGuide'
import Integrations from '../src/components/sections/Integrations'
import Benefits from '../src/components/sections/Benefits'
import HowItWorks from '../src/components/sections/HowItWorks'
import LatestUpdate from '../src/components/sections/LatestUpdate'
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'


export default function HomePage() {
  return (
    <div className="min-h-screen">

      

      <Header />
      <main>
        <Hero />
        <BuiltForEngineers />
        <WorksOutOfTheBox />
        <SecuritySection />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}