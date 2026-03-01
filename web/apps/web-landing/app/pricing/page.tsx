'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import Pricing from '../../src/components/sections/Pricing'
import Faq from '../../src/components/sections/Faq'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'

export default function PricingPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="relative min-h-screen bg-[#f7f7f3] dark:bg-[#0A0A0A]">

        <div className="relative z-10">
          <Header />
          <main>
            <Pricing />
            <Faq />
            <ClosingPosition />
          </main>
          <Footer />
        </div>
      </div>
      <EarlyAccessModal
        isOpen={isEarlyAccessModalOpen}
        onClose={closeEarlyAccessModal}
      />
    </>
  );
}
