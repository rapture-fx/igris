'use client';

import { Metadata } from 'next';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function TermsPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Terms of Service</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                <strong>Last updated: November 24, 2025</strong>
              </p>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                These Terms of Service govern your access to and use of Schlep-engine services, including the Schlep-engine API located at www.schlep-engine.com (the "Service").
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. Description of Service</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Schlep-engine is an LLM routing and orchestration platform. We route your requests to third-party AI providers using your own API keys (BYOK). We do not train on your data, store your prompts, or retain your outputs beyond transient processing.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                2.1 You retain full ownership and control of all data and API keys.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                2.2 We act solely as a processor/router on your behalf.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Your Responsibilities</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">You are responsible for:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>All activity occurring under your account</li>
                <li>Compliance with the terms of service of the third-party AI providers you connect</li>
                <li>Ensuring your use of the Service complies with applicable laws</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Prohibited Uses</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">You may not use the Service to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Violate any law or regulation</li>
                <li>Infringe intellectual property rights</li>
                <li>Generate spam, malware, or harmful content</li>
                <li>Attempt to reverse-engineer or interfere with the Service</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">5. Fees & Payment</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                You agree to pay all fees according to the pricing plan selected. All fees are non-refundable except as expressly stated.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">6. Termination</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We may suspend or terminate your access immediately if you breach these Terms or if required by third-party terms.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">7. Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                To the fullest extent permitted by law, Schlep-engine shall not be liable for indirect, incidental, special, consequential, or punitive damages. Our total liability shall not exceed the amount you paid us in the 12 months prior to the claim.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">8. Governing Law</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                These Terms are governed by the laws of Indonesia, without regard to conflict of law principles.
              </p>

              <p className="text-gray-700 dark:text-gray-300 mt-8">
                For questions: <a href="mailto:support@schlep-engine.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@schlep-engine.com</a>
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
