'use client';

import Head from 'next/head';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function CookiesPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <Head>
        <title>Igris Inertial Cookie Policy</title>
        <meta name="description" content="Our minimal cookie usage — only necessary and anonymous analytics." />
      </Head>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Cookie Policy</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                <strong>Last updated: November 26, 2025</strong>
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We use only strictly necessary cookies and privacy-preserving analytics (Plausible). No tracking, advertising, or third-party cookies.
              </p>

              <p className="text-gray-700 dark:text-gray-300 mt-8">
                Contact: support@igris-inertial.com
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
