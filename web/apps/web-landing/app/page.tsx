'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import BlankSection from '../src/components/sections/BlankSection'
import MultiTenancy from '../src/components/sections/MultiTenancy'
import Products from '../src/components/sections/Products'
import UseCasesTeaser from '../src/components/sections/UseCasesTeaser'
import ForDevelopers from '../src/components/sections/ForDevelopers'
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
          <Products />
          <CoreCapabilities />
          <UseCasesTeaser />
          <ForDevelopers />
          <BlankSection />
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