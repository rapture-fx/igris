'use client';

import Head from 'next/head';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function PrivacyPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <Head>
        <title>Igris Inertial Privacy Policy</title>
        <meta name="description" content="We do not store your prompts, responses, or API keys. Full BYOK privacy." />
      </Head>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Privacy Policy</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                <strong>Last updated: November 26, 2025</strong>
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Igris Inertial Inc. ("we", "us", "our") operates the service at www.igris-inertial.com.
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We do not store your prompts, model outputs, or API keys. All data is processed in memory and deleted immediately after routing.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Data We Do NOT Collect or Store</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Your LLM prompts or completions</li>
                <li>Your API keys (encrypted in memory only)</li>
                <li>Any personal data beyond billing email</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Data Processing (BYOK)</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                All requests are routed directly from your client to third-party providers using your own API keys. We act as a conduit only — data passes through our servers in memory and is deleted immediately after routing.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Data We Do Collect</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Billing information (processed by Polar.sh)</li>
                <li>Aggregate usage metrics (request count, latency) for billing and performance</li>
                <li>Anonymous analytics via Plausible (no personal data)</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Security</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We use AES-256 encryption, TLS 1.3, and regular security audits.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Your Rights</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Request access, deletion, or correction at any time: support@igrisinertial.com
              </p>

              <p className="text-gray-700 dark:text-gray-300 mt-8">
                Questions? Contact us at <a href="mailto:support@igrisinertial.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@igrisinertial.com</a>
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
