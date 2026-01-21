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
      <div className="relative min-h-screen bg-[#0A0A0A]">
        <div className="absolute top-0 right-0 w-full h-[120vh] bg-cover bg-no-repeat z-50 opacity-25 pointer-events-none" style={{ backgroundImage: 'url(/hub.png)', backgroundPosition: 'center -100px' }} />
        <div className="relative z-10">
          <Header />
          <main className="pt-[70px]">
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
