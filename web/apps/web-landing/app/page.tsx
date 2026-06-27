'use client';

import Header from '../src/components/sections/Header'
import Vision from '../src/components/sections/Vision'

import UseCasesPopup from '../src/components/popups/UseCasesPopup'

import { useProductPopup } from '../src/contexts/ProductPopupContext'
import LandingScrollManager from '../src/components/LandingScrollManager'

export default function HomePage() {

  const { isUseCasesOpen, closeUseCases } = useProductPopup();

  return (
    <>
      <div className="igris-grain min-h-screen bg-white dark:bg-[#110f0f] transition-colors duration-200">
        <LandingScrollManager />
        <Header />
        <main className="pt-16">
          <Vision />
        </main>
      </div>

      <UseCasesPopup
        isOpen={isUseCasesOpen}
        onClose={closeUseCases}
      />
    </>
  );
}