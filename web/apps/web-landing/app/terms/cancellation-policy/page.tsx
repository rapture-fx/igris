'use client';

import Head from 'next/head';
import Header from '../../../src/components/sections/Header';
import Footer from '../../../src/components/sections/Footer';
import EarlyAccessModal from '../../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../../src/contexts/ModalContext';

export default function CancellationPolicyPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <Head>
        <title>Cancellation Policy — Igris Inertial</title>
        <meta name="description" content="How to cancel your Igris Inertial subscription." />
      </Head>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-16">
              {/* Main Content */}
              <article className="prose prose-lg dark:prose-invert max-w-none">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Cancellation Policy</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  <strong>Last updated: November 26, 2025</strong>
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  You can cancel your subscription at any time — no questions asked, no cancellation fees.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">How to Cancel</h2>
                <ul className="list-decimal pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                  <li>Log in to your account</li>
                  <li>Go to Billing → Manage Subscription</li>
                  <li>Click "Cancel Subscription"</li>
                </ul>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Your access continues until the end of your current billing period. No partial refunds for monthly plans.
                </p>

                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Downgrading</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Want to switch to a lower tier? Just change your plan — it takes effect at the start of the next billing cycle.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Questions? Email <a href="mailto:support@igrisinertial.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@igrisinertial.com</a>
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
                        Cancellation Policy
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
