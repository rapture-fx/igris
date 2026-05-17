'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import Products from '../src/components/sections/Products'
import Capabilities from '../src/components/sections/Capabilities'
import WhenToUseIgris from '../src/components/sections/WhenToUseIgris'
import ClosingPosition from '../src/components/sections/ClosingPosition'
import Footer from '../src/components/sections/Footer'
import WhyItExists from '../src/components/sections/WhyItExists'

import UseCasesPopup from '../src/components/popups/UseCasesPopup'

import { useProductPopup } from '../src/contexts/ProductPopupContext'
import ScrollReveal from '../src/components/ui/ScrollReveal'

const frameClass = "border-l border-r border-gray-200 dark:border-[rgba(246,246,244,0.07)]"
const sectionFrameClass = "border border-gray-200 dark:border-[rgba(246,246,244,0.12)] mx-auto my-3 max-w-[1100px] rounded-lg overflow-hidden"

export default function HomePage() {

  const { isUseCasesOpen, closeUseCases } = useProductPopup();

  return (
    <>
      <div className="igris-grain min-h-screen bg-white dark:bg-[#110f0f] transition-colors duration-200">
        <Header />
        <main className="mx-auto max-w-[1440px]">
          <ScrollReveal delay={0.1}><Hero /></ScrollReveal>
          <div className={sectionFrameClass}><ScrollReveal delay={0.1}><Products /></ScrollReveal></div>
          <div className={sectionFrameClass}><ScrollReveal delay={0.1}><Capabilities /></ScrollReveal></div>
          <div className={sectionFrameClass}><ScrollReveal delay={0.1}><WhenToUseIgris /></ScrollReveal></div>
          <div className={sectionFrameClass}><ScrollReveal delay={0.1}><WhyItExists /></ScrollReveal></div>
          <div className={sectionFrameClass}><ScrollReveal delay={0.1}><ClosingPosition /></ScrollReveal></div>
        </main>
        <Footer />
      </div>

      <UseCasesPopup
        isOpen={isUseCasesOpen}
        onClose={closeUseCases}
      />
    </>
  );
}