'use client';

import Head from 'next/head';
import Header from '../../../src/components/sections/Header';
import Footer from '../../../src/components/sections/Footer';
import EarlyAccessModal from '../../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../../src/contexts/ModalContext';

export default function RefundPolicyPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <Head>
        <title>Refund Policy — Igris Inertial</title>
        <meta name="description" content="Refund and cancellation policy for Igris Inertial subscriptions." />
      </Head>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-16">
              {/* Main Content */}
              <article className="prose prose-lg dark:prose-invert max-w-none">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Refund Policy</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  <strong>Last updated: November 26, 2025</strong>
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  At Schlep-engine, we want you to be completely satisfied. Here's our simple, no-surprises refund policy:
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Monthly Subscriptions</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  No refunds on monthly subscriptions after the 14-day free trial ends. You may cancel anytime — no questions asked — and your access continues until the end of the current billing period.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Annual Subscriptions</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  If you cancel within 30 days of purchase, we'll refund the full amount. After 30 days, no refunds, but you keep access until the end of the 12-month term.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Free Trial</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  The 14-day trial is completely free. No charges until you upgrade. You can cancel anytime during the trial with zero cost.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">How to Request a Refund</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Email <a href="mailto:support@schlep-engine.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@schlep-engine.com</a> with your account details. Refunds are processed within 5–7 business days.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  We stand behind our 180 ms first token promise — if it doesn't deliver for you in the first 30 days, we'll make it right.
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
                        Refund Policy
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
