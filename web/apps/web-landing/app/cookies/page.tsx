'use client';

import { Metadata } from 'next';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function CookiesPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Cookie Policy</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                <strong>Last updated: November 24, 2025</strong>
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We use only strictly necessary cookies and anonymous analytics.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Cookies We Use</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Authentication cookies (session management)</li>
                <li>Preference cookies (dark mode, language)</li>
                <li>Analytics via Plausible (privacy-first, no personal data)</li>
              </ul>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We do not use tracking, advertising, or third-party cookies.
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                You can disable cookies in your browser settings, though some features may not work.
              </p>

              <p className="text-gray-700 dark:text-gray-300 mt-8">
                Contact: <a href="mailto:support@schlep-engine.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@schlep-engine.com</a>
              </p>
            </article>
          </div>
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
