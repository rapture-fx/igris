'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import MultiTenancy from '../src/components/sections/MultiTenancy'
import Products from '../src/components/sections/Products'
import HowItWorks from '../src/components/sections/HowItWorks'
import ClosingPosition from '../src/components/sections/ClosingPosition'
import EarlyAccessModal from '../src/components/modals/EarlyAccessModal'
import { useModal } from '../src/contexts/ModalContext'

export default function HomePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
        <Header />
        <main className="pt-[70px]">
          <Hero />
          <Products />
          <CoreCapabilities />
          <HowItWorks />
          <MultiTenancy />
          <ClosingPosition />
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