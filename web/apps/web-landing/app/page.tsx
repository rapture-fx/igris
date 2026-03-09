'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import InstallSection from '../src/components/sections/InstallSection'
import ClosingPosition from '../src/components/sections/ClosingPosition'
import WhyItExists from '../src/components/sections/WhyItExists'
import Footer from '../src/components/sections/Footer'

import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import MultiTenancy from '../src/components/sections/MultiTenancy'
import Products from '../src/components/sections/Products'
import SDKs from '../src/components/sections/SDKs'
import AutonomousSystems from '../src/components/sections/AutonomousSystems'

import UseCasesPopup from '../src/components/popups/UseCasesPopup'

import AIAgentView from '../src/components/AIAgentView'
import ViewModeToggle from '../src/components/ViewModeToggle'

import { useProductPopup } from '../src/contexts/ProductPopupContext'
import { useViewMode } from '../src/contexts/ViewModeContext'

export default function HomePage() {

  const { isUseCasesOpen, closeUseCases } = useProductPopup();
  const { isAIAgentMode } = useViewMode();

  return (
    <>
      {isAIAgentMode ? (
        <AIAgentView />
      ) : (
        <div className="min-h-screen bg-white dark:bg-[#0A0A0A] transition-colors duration-200">
          <Header />
          <main>
            <Hero />
            <Products />
            <CoreCapabilities />
            <AutonomousSystems />
            <SDKs />
            <MultiTenancy />
            <WhyItExists />
            <ClosingPosition />
          </main>
          <Footer />
        </div>
      )}

      <ViewModeToggle />

      <UseCasesPopup
        isOpen={isUseCasesOpen}
        onClose={closeUseCases}
      />
    </>
  );
}
