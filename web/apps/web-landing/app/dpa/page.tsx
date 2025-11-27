'use client';

import Head from 'next/head';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function DPAPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <Head>
        <title>Data Processing Agreement (DPA) — Schlep Engine</title>
        <meta name="description" content="GDPR/CCPA-compliant DPA for Schlep Engine customers." />
      </Head>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-16">
              {/* Main Content */}
              <article className="prose prose-lg dark:prose-invert max-w-none">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Data Processing Agreement</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  <strong>Last updated: November 26, 2025</strong>
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This Data Processing Agreement ("DPA") forms part of the Terms of Service between Schlep-engine Inc. ("Processor" and "Schlep Engine") and you ("Controller").
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Subject Matter</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Schlep Engine acts as a Processor of personal data only when routing requests using your own API keys (BYOK). We do not store, log, or retain any prompts, outputs, or personal data beyond transient in-memory processing.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. Nature and Purpose of Processing</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Transient routing of requests to third-party AI providers. No training, no profiling, no storage.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Duration</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  As long as you use the Service.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Types of Personal Data</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  None — we do not collect or process personal data. All data is processed under your direct control via BYOK.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">5. Categories of Data Subjects</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Not applicable — no personal data processed.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">6. Security Measures</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  AES-256 encryption in transit and at rest (memory only), TLS 1.3, regular penetration testing.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">7. Sub-processors</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Polar.sh (billing), Plausible.io (anonymous analytics). List available on request.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">8. Your Rights</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  You may request deletion or audit at any time: <a href="mailto:support@schlep-engine.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@schlep-engine.com</a>
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This DPA is governed by the laws of Delaware, United States.
                </p>
              </article>

              {/* Table of Contents - Sticky Sidebar */}
              <aside className="hidden lg:block">
                <nav className="sticky top-24">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                    On this page
                  </h3>
                  <ul className="space-y-3 text-sm">
                    <li>
                      <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Data Processing Agreement
                      </a>
                    </li>
                  </ul>
                </nav>
              </aside>
            </div>
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
