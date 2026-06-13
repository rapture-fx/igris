'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
import Products from '../src/components/sections/Products'
import WhenToUseIgris from '../src/components/sections/WhenToUseIgris'
import ExecutionPath from '../src/components/sections/ExecutionPath'
import Faq from '../src/components/sections/Faq'
import ClosingPosition from '../src/components/sections/ClosingPosition'
import Footer from '../src/components/sections/Footer'

import UseCasesPopup from '../src/components/popups/UseCasesPopup'

import { useProductPopup } from '../src/contexts/ProductPopupContext'
import ScrollReveal from '../src/components/ui/ScrollReveal'

const frameClass = "border-l border-r border-gray-200 dark:border-[rgba(246,246,244,0.07)]"
const sectionFrameClass = "my-3 border border-gray-200 dark:border-[rgba(246,246,244,0.12)] rounded-lg overflow-hidden"

export default function HomePage() {

  const { isUseCasesOpen, closeUseCases } = useProductPopup();

  return (
    <>
      <div className="igris-grain min-h-screen bg-white dark:bg-[#110f0f] transition-colors duration-200 pt-14">
        <Header />
        <main>
          <ScrollReveal delay={0.1}><Hero /></ScrollReveal>
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8"><div><ScrollReveal delay={0.1}><WhenToUseIgris /></ScrollReveal></div></div>
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8"><div><ScrollReveal delay={0.1}><Products /></ScrollReveal></div></div>
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8"><div><ScrollReveal delay={0.1}><ExecutionPath /></ScrollReveal></div></div>
          <ScrollReveal delay={0.1}><Faq large /></ScrollReveal>
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8"><div><ScrollReveal delay={0.1}><ClosingPosition /></ScrollReveal></div></div>
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