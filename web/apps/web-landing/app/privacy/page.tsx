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
              <p className="text-gray-700 dark:text-gray-300 mb-3">Under Indonesian data protection law, you have the right to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and data</li>
                <li>Export your usage data (JSON format)</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                To exercise these rights, email support@schlep-engine.com
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">6. Data Retention</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li><strong>Usage Metrics:</strong> Retained for 90 days for billing purposes</li>
                <li><strong>Audit Logs:</strong> Retained for 1 year for security and compliance</li>
                <li><strong>Billing Records:</strong> Retained for 7 years per tax law requirements</li>
                <li><strong>API Keys:</strong> Deleted immediately upon request or account termination</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">7. Third-Party Sharing</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We share limited data with:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li><strong>Polar.sh:</strong> Billing email and subscription status only</li>
                <li><strong>AI Providers:</strong> Only your prompts/responses (using YOUR API keys)</li>
                <li><strong>SSO Providers:</strong> Authentication tokens for login verification</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We do NOT sell your data to third parties.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">8. Security Incident Response</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">In the event of a data breach affecting your account:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>We will notify you within 72 hours via email</li>
                <li>Notification will include affected data types and recommended actions</li>
                <li>We will cooperate with regulators as required by law</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">9. Data Location</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">Schlep-engine is based in Indonesia. Your data may be processed on servers located in:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li>Indonesia (primary)</li>
                <li>Singapore, United States (cloud infrastructure)</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                By using the Service, you consent to cross-border data transfers necessary for routing.
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
