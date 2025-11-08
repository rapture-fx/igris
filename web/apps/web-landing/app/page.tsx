'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import TechStack from '../src/components/sections/TechStack'
import BlankSection from '../src/components/sections/BlankSection'
import BenchmarkResults from '../src/components/sections/BenchmarkResults'
import MultiTenancy from '../src/components/sections/MultiTenancy'
import Observability from '../src/components/sections/Observability'
import EarlyAccessModal from '../src/components/modals/EarlyAccessModal'
import { useModal } from '../src/contexts/ModalContext'

export default function HomePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px] space-y-1">
          <Hero />
          <CoreCapabilities />
          <TechStack />
          <BlankSection />
          <BenchmarkResults />
          <Observability />
          <MultiTenancy />
          <CallToAction />
        </main>
        <Footer />
      </div>
      <EarlyAccessModal
        isOpen={isEarlyAccessModalOpen}
        onClose={closeEarlyAccessModal}
      />
    </>
  );
}