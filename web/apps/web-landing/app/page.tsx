'use client';

import Header from '../src/components/sections/Header'
import Hero from '../src/components/sections/Hero-Simple'
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
            <section className="bg-white dark:bg-dark-bg">
              <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
              <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', height: '400px' }} />
              </div>
            </section>
            <Products />
            <CoreCapabilities />
            <AutonomousSystems />
            <SDKs />
            <MultiTenancy />
            <section className="bg-white dark:bg-dark-bg">
              <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
              <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
                  <table className="w-full" style={{ borderCollapse: 'collapse', height: '400px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '65%', padding: '3rem 2rem 3rem 0', verticalAlign: 'top', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
                          <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', marginBottom: '2rem' }}>
                            Latest Update
                          </h3>
                          <div className="flex flex-col gap-4">
                            <div className="border border-gray-200 dark:border-[#f6f6f4]/10 rounded-xl p-4 bg-[#f9f9fa] dark:bg-[#1b1912]/60" style={{ minHeight: '120px' }}>
                            </div>
                            <div className="border border-gray-200 dark:border-[#f6f6f4]/10 rounded-xl p-4 bg-[#f9f9fa] dark:bg-[#1b1912]/60" style={{ minHeight: '120px' }}>
                            </div>
                            <div className="border border-gray-200 dark:border-[#f6f6f4]/10 rounded-xl p-4 bg-[#f9f9fa] dark:bg-[#1b1912]/60" style={{ minHeight: '120px' }}>
                            </div>
                          </div>
                        </td>
                        <td style={{ width: '35%', padding: '3rem 0 3rem 2rem', verticalAlign: 'top' }}>
                          <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                            Change Log
                          </h3>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
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
