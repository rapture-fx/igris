'use client';

import { Metadata } from 'next';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function PrivacyPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Privacy Policy</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                <strong>Last updated: November 24, 2025</strong>
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Schlep-engine operates the Schlep-engine API at www.schlep-engine.com. This Privacy Policy explains how we handle your information.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Data We Do NOT Collect</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We do not store, log, or retain:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Your prompts or completions</li>
                <li>Your API keys (encrypted in memory only)</li>
                <li>Any personal data beyond billing email and payment information</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. Data Processing (BYOK)</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                All requests are routed directly from your client to third-party providers using your own API keys. We act as a conduit only — data passes through our servers in memory and is deleted immediately after routing.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Data We Do Collect</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Billing information (processed by polar.sh)</li>
                <li>Usage metrics (request count, latency) for billing and performance</li>
                <li>Anonymous analytics (Plausible)</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Security</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We use industry-standard encryption (AES-256, TLS 1.3) and never store your API keys in plaintext.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">5. Your Rights</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                You may request deletion of your account and data at any time by emailing support@schlep-engine.com.
              </p>

              <p className="text-gray-700 dark:text-gray-300 mt-8">
                Questions? Contact us at <a href="mailto:support@schlep-engine.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@schlep-engine.com</a>
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
