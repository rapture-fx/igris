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

import { useProductPopup } from '../src/contexts/ProductPopupContext'
import ScrollReveal from '../src/components/ui/ScrollReveal'

export default function HomePage() {

  const { isUseCasesOpen, closeUseCases } = useProductPopup();

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#1b1912] transition-colors duration-200">
        <Header />
        <main>
          <ScrollReveal><Hero /></ScrollReveal>
          <ScrollReveal delay={0.1}><Products /></ScrollReveal>
          <ScrollReveal delay={0.1}><AutonomousSystems /></ScrollReveal>
          <ScrollReveal delay={0.1}><SDKs /></ScrollReveal>
          <ScrollReveal delay={0.1}><CoreCapabilities /></ScrollReveal>
          <ScrollReveal delay={0.1}><MultiTenancy /></ScrollReveal>
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
