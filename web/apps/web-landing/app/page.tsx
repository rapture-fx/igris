'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import Solve from '../src/components/sections/Solve'
import Footer from '../src/components/sections/Footer'
import CallToAction from '../src/components/sections/CallToAction'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import MultiTenancy from '../src/components/sections/MultiTenancy'
import Products from '../src/components/sections/Products'
import HowItWorks from '../src/components/sections/HowItWorks'
import Manifesto from '../src/components/sections/Manifesto'
import ClosingPosition from '../src/components/sections/ClosingPosition'

import OverturePopup from '../src/components/popups/OverturePopup'
import RuntimePopup from '../src/components/popups/RuntimePopup'
import UseCasesPopup from '../src/components/popups/UseCasesPopup'

import { useProductPopup } from '../src/contexts/ProductPopupContext'

export default function HomePage() {

  const { isOvertureOpen, closeOverture, isRuntimeOpen, closeRuntime, isUseCasesOpen, closeUseCases } = useProductPopup();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
        <Header />
        <main>
          <Hero />
          <Solve />
          <Products />
          <CoreCapabilities />
          <HowItWorks />
          <MultiTenancy />
          <Manifesto />
          <ClosingPosition />
        </main>
        <Footer />
      </div>

      <OverturePopup
        isOpen={isOvertureOpen}
        onClose={closeOverture}
      />
      <RuntimePopup
        isOpen={isRuntimeOpen}
        onClose={closeRuntime}
      />
      <UseCasesPopup
        isOpen={isUseCasesOpen}
        onClose={closeUseCases}
      />
    </>
  );
}