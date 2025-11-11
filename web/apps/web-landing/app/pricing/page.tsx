'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import Pricing from '../../src/components/sections/Pricing'
import Faq from '../../src/components/sections/Faq'
import RoiCalculator from '../../src/components/sections/RoiCalculator'
import CallToAction from '../../src/components/sections/CallToAction'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'

export default function PricingPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <Pricing />
          <Faq />
          <RoiCalculator />
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
