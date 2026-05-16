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

export default function HomePage() {

  const { isUseCasesOpen, closeUseCases } = useProductPopup();

  return (
    <>
      <div className="igris-grain min-h-screen bg-white dark:bg-[#110f0f] transition-colors duration-200">
        <Header />
        <main>
          <Hero />
          <ScrollReveal delay={0.1}><Products /></ScrollReveal>
          <ScrollReveal delay={0.1}><Capabilities /></ScrollReveal>
          <ScrollReveal delay={0.1}><WhenToUseIgris /></ScrollReveal>
          <ScrollReveal delay={0.1}><WhyItExists /></ScrollReveal>
          <ScrollReveal delay={0.1}><ClosingPosition /></ScrollReveal>
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
