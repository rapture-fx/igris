import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple';
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import TechStack from '../src/components/sections/TechStack'
import BlankSection from '../src/components/sections/BlankSection'
import BenchmarkResults from '../src/components/sections/BenchmarkResults'





import MultiTenancy from '../src/components/sections/MultiTenancy'
import Observability from '../src/components/sections/Observability'
export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main style={{ backgroundColor: '#f6f6f4', paddingTop: '70px' }}>
        <Hero />
        <div style={{ paddingTop: '5px' }}>
        <CoreCapabilities />
        </div>
        <div style={{ paddingTop: '5px' }}>
        <TechStack />
        </div>
        <div style={{ paddingTop: '5px' }}>
        <BlankSection />
        </div>
        <div style={{ paddingTop: '5px' }}>
        <BenchmarkResults />
        </div>
        
        <div style={{ paddingTop: '5px' }}>
        <Observability />
        </div>
        <div style={{ paddingTop: '5px' }}>
        <MultiTenancy />
        </div>
        
        <div style={{ paddingTop: '5px' }}>
        <CallToAction />
        </div>
      </main>
      <Footer />
    </div>
  )
}