'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import WhatThisIs from '../src/components/sections/WhatThisIs'
import WhyItExists from '../src/components/sections/WhyItExists'
import Footer from '../src/components/sections/Footer'
import Solve from '../src/components/sections/Solve'
import CoreCapabilities from '../src/components/sections/CoreCapabilities'
import MultiTenancy from '../src/components/sections/MultiTenancy'
import Products from '../src/components/sections/Products'
import HowItWorks from '../src/components/sections/HowItWorks'

import OverturePopup from '../src/components/popups/OverturePopup'
import RuntimePopup from '../src/components/popups/RuntimePopup'
import UseCasesPopup from '../src/components/popups/UseCasesPopup'

import AIAgentView from '../src/components/AIAgentView'
import ViewModeToggle from '../src/components/ViewModeToggle'

import { useProductPopup } from '../src/contexts/ProductPopupContext'
import { useViewMode } from '../src/contexts/ViewModeContext'

export default function HomePage() {

  const { isOvertureOpen, closeOverture, isRuntimeOpen, closeRuntime, isUseCasesOpen, closeUseCases } = useProductPopup();
  const { isAIAgentMode } = useViewMode();

  return (
    <>
      {isAIAgentMode ? (
        <AIAgentView />
      ) : (
        <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200 pb-20">
          <Header />
          <main>
            <Hero />
            <Solve />
            <Products />
            <WhatThisIs />
            <CoreCapabilities />
            <MultiTenancy />
            <HowItWorks />
            <WhyItExists />
          </main>
          <Footer />
        </div>
      )}

      <ViewModeToggle />

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
