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

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">9. Third-Party Services & Subprocessors</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">Our Service integrates with the following third-party providers:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li><strong>Payment Processing:</strong> Polar.sh (for billing and subscriptions)</li>
                <li><strong>AI Providers:</strong> You connect your own API keys to OpenAI, Anthropic, Google, and other LLM providers. We do not control or guarantee the availability of these services.</li>
                <li><strong>SSO Providers:</strong> OAuth2 (Auth0, Okta, Google, Microsoft) and SAML 2.0 for authentication</li>
                <li><strong>Infrastructure:</strong> Redis (caching), PostgreSQL (state management)</li>
                <li><strong>Monitoring:</strong> Prometheus, OpenTelemetry for observability</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                You acknowledge that we are not responsible for the performance, availability, or policies of third-party services.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">10. Service Availability</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We strive for high availability but do not guarantee uninterrupted service. We are not liable for:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li>Downtime caused by third-party AI providers</li>
                <li>Scheduled maintenance windows</li>
                <li>Force majeure events</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Current tier SLA targets are defined in your subscription plan.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">11. API Key Management</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">When you provide API keys (BYOK - Bring Your Own Keys):</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Keys are encrypted using AES-256-GCM and stored in our secure key vault</li>
                <li>Keys are only decrypted in memory during request routing</li>
                <li>You remain solely responsible for rotating and securing your API keys</li>
                <li>We are NOT liable for costs incurred from API key misuse or leakage</li>
                <li>You must immediately notify us if you suspect key compromise</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">12. Cost Tracking & Budget Limits</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We enforce real-time budget limits:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>When your budget is exceeded, requests will be blocked with HTTP 402 (Payment Required)</li>
                <li>Alerts are sent at 90% (soft warning) and 100% (hard limit)</li>
                <li>You are responsible for monitoring your usage and budget</li>
                <li>Overage charges apply per your subscription tier</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">13. Beta & Experimental Features</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">Features in our /labs directory or marked as "beta" are provided AS-IS without warranty. These include:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li>Speculative execution (multi-provider racing)</li>
                <li>Council mode (multi-model consensus)</li>
                <li>Cognitive optimization features</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                We may discontinue or modify experimental features without notice.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">14. AI Content Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">Schlep-engine acts solely as a routing intermediary. We do NOT:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li>Generate, train, or modify AI model outputs</li>
                <li>Validate accuracy of AI-generated content</li>
                <li>Accept liability for harmful, biased, or inaccurate outputs</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                You are solely responsible for reviewing and validating AI-generated content before use.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">15. Modifications to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We may update these Terms at any time. Changes will be effective:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                <li>Immediately for non-material changes</li>
                <li>30 days after email notification for material changes</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Continued use after changes constitutes acceptance.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">16. Dispute Resolution</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">Any disputes shall be resolved through:</p>
              <ol className="list-decimal pl-6 text-gray-700 dark:text-gray-300 mb-3 space-y-2">
                <li>Good-faith negotiation for 30 days</li>
                <li>Binding arbitration under Indonesian law if negotiation fails</li>
                <li>Venue: Jakarta, Indonesia</li>
              </ol>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Class action waiver: You agree to resolve disputes individually, not as part of a class action.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">17. Eligibility</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                You must be at least 18 years old to use Schlep-engine. By using the Service, you represent that you meet this requirement.
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
