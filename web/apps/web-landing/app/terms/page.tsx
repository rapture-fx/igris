'use client';

import Head from 'next/head';
import Header from '../../src/components/sections/Header';
import Footer from '../../src/components/sections/Footer';
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal';
import { useModal } from '../../src/contexts/ModalContext';

export default function TermsPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  return (
    <>
      <Head>
        <title>Igris Inertial Terms of Service</title>
        <meta name="description" content="Legal terms for using Igris Inertial services, execution surfaces, and operator tooling." />
      </Head>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-16">
              {/* Main Content */}
              <article className="prose prose-lg dark:prose-invert max-w-none">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Terms of Service</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  <strong>Last updated: November 26, 2025</strong>
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This Customer Terms of Service is entered into by and between Igris Inertial Inc. ("Igris Inertial") and the entity or person placing an order for or accessing any Services ("Customer" or "you"). If you are accessing or using the Services on behalf of your company, you represent that you are authorized to accept this Agreement on behalf of your company, and all references to "you" or "Customer" reference your company.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This Agreement permits Customer to purchase subscriptions to online software-as-a-service products and other services from Igris Inertial pursuant to any Igris Inertial ordering documents, online registration, order descriptions or order confirmations referencing this Agreement ("Order Form(s)") and sets forth the basic terms and conditions under which those products and services will be delivered.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  The "Effective Date" of this Agreement is the earlier of (a) Customer's initial access to the Services (as defined below) through any online provisioning, registration or order process or (b) the effective date of the first Order Form referencing this Agreement.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  PLEASE NOTE: IF YOU SUBSCRIBE TO THE SERVICES FOR A SUBSCRIPTION TERM, THEN YOUR SUBSCRIPTION AND THIS AGREEMENT WILL BE AUTOMATICALLY RENEWED FOR SUCCESSIVE BILLING PERIODS AT OUR THEN-CURRENT PRICING FOR SUCH SERVICES UNLESS YOU OPT OUT OF THE AUTO-RENEWAL IN ACCORDANCE WITH SECTION 8 BELOW.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  PLEASE NOTE: THAT SECTION 11.9 OF THIS AGREEMENT CONTAINS AN ARBITRATION AGREEMENT THAT REQUIRES MOST DISPUTES BETWEEN US TO BE RESOLVED ON AN INDIVIDUAL, NON-CLASS ACTION BASIS THROUGH BINDING AND FINAL ARBITRATION INSTEAD OF IN COURT. SEE SECTION 11.9 FOR MORE INFORMATION REGARDING THIS ARBITRATION CLAUSE AND HOW TO OPT OUT.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  By indicating your acceptance of this agreement or accessing or using any services, you are agreeing to be bound by all terms, conditions, and notices contained or referenced in this agreement. if you do not agree to this agreement, please do not use any services. for clarity, each party expressly agrees that this agreement is legally binding upon it.
                </p>

                <h2 id="definitions" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Definitions</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Affiliate" means, with respect to a party, any entity which directly or indirectly Controls, is Controlled by, or is under common Control with such party.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Agreement" means this Customer Terms of Service, any Order Forms, and any attachments, linked policies or documents referenced in the foregoing.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Beta Services" means services or features identified as "alpha," "beta," "preview," "early access," or "evaluation," or words or phrases with similar meanings.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Igris Inertial Materials" means all software, specifications, documentation and systems and any and all other information, data, documents, materials, works and other content, devices, methods, processes, hardware and other technologies and inventions, technical or functional descriptions, requirements, plans or reports, that are provided or used by Igris Inertial in connection with the Services or otherwise comprise or relate to the Services or the Platform. Igris Inertial Materials do not include Customer Data.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Control" means 50% or greater voting power, or otherwise having the power to govern the financial and the operating policies or to appoint the management of an organization.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Customer Chosen Third-Party Product" means a product, service, application, functionality, or content that is provided by a third-party or by Customer and that Customer or any of its Authorized Users chooses to interoperate or use in connection with the Services.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Customer Data" means any data in electronic form that Customer or Users make available through the Platform or that is otherwise collected by Company on behalf of Customer or its Users.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Documentation" means Igris Inertial's user guides and other end user documentation for the Services made available by Igris Inertial to its customers generally at support.igris-inertial.com.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Enterprise Tier Services" means the Services that Igris Inertial makes available under its "Enterprise" tier Service Plan.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Free Services" means the Services that Igris Inertial makes available free of charge.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Fees" means any fees payable for the Services under the Order Form.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Force Majeure Event" means an event which is unforeseeable, beyond the control of the party affected, and cannot be remedied by the exercise of reasonable diligence, including without limitation: acts of God, acts of government, flood, fire, earthquakes, civil unrest, acts of terror, strikes, computer, telecommunications, Internet service provider or hosting facility failures or delays involving hardware, software or power systems not within Igris Inertial's possession or reasonable control, and denial of service attacks.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Pricing Page" means the publicly available web page(s) where Igris Inertial publishes its list prices for Services, currently available at <a href="https://www.igris-inertial.com/pricing" className="text-blue-600 dark:text-blue-400 hover:underline">https://www.igris-inertial.com/pricing</a>.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Pro Tier Services" means the individual licenses to the Services that Igris Inertial makes available under a non-enterprise tier Service Plan.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Service Plan" means the packaged subscription plan and associated features, as detailed at the Pricing Page to which Customer subscribes.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Services" means the services that Igris Inertial will provide to Customer under this Agreement as described in the applicable Order Form.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  "Usage Data" means any diagnostic and usage-related information and data from the use, performance and operation of the Platform and Services that may include, but is not limited to, usage patterns, traffic logs, and User engagement with the Platform and Services.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  "Users" means employees, agents, consultants or other representatives authorized by Customer to access or use the Services.
                </p>

                <h2 id="services" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. The Services</h2>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.1 Services</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Subject to the terms and conditions set forth in this Agreement and the applicable Order Form, Igris Inertial grants to Customer a limited, non-transferable, non-assignable (except as set forth in the Agreement), non-exclusive right to access and use the Services during the Subscription Period for its lawful internal business purposes solely in the form provided by Igris Inertial and as permitted by the functionalities provided by Igris Inertial therein.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.2 Software</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Igris Inertial may make Software available as part of the Services. Subject to the terms and conditions set forth in this Agreement and the applicable Order Form, Igris Inertial grants to Customer and its Users a limited non-exclusive, non-transferable, non-sublicensable license to download and install the Software to the extent necessary to use the Services. Software may update automatically. To the extent a component of the Software contains any open source software, the open source license for that software will govern with respect to that component.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.3 Igris Inertial Ownership</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  All rights and title in and to the Platform, the Services, Software, Usage Data, Aggregate and De-Identified Data, Igris Inertial Materials and Documentation, including all enhancements, derivatives, and improvements to the foregoing and all Intellectual Property Rights inherent therein, belong exclusively to Igris Inertial and its licensors. No rights are granted to Customer other than as expressly set forth in this Agreement. Nothing herein shall be construed as prohibiting Igris Inertial from utilizing the Usage Data for purposes of operating Igris Inertial's business; provided that Igris Inertial will not disclose any Usage Data to any third-party in a manner that could identify Customer or any individual.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.4 Customer Chosen Third-Party Products</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  The Platform may contain features designed to interoperate with Customer Chosen Third-Party Products. Such Customer Chosen Third-Party Products are not under Igris Inertial's control, and Igris Inertial makes no representations or warranties with respect to, is not responsible or liable for, and does not endorse any Customer Chosen Third-Party Products. Customer and its Authorized Users use all such Customer Chosen Third-Party Products at their own risk and will need to make their own independent judgment regarding any interaction or interoperation between them and the Services. Any acquisition by Customer of Customer Chosen Third-Party Products, and any exchange of Customer Data between Customer and any Customer Chosen Third-Party Product provider, product or service, is solely between Customer and the applicable Customer Chosen Third-Party Product provider. Igris Inertial is not responsible for any disclosure, modification or deletion of Customer Data resulting from access by any Customer Chosen Third-Party Product or its provider. Customer is solely responsible for ensuring that it has all necessary licenses and rights to use the Customer Chosen Third-Party Product for the purposes contemplated herein.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.5 Free Services</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Use of Free Services is subject to the terms and conditions of this Agreement. In the event of a conflict between this section and any other portion of this Agreement, this section shall control. Free Services are provided to Customer without charge up to certain limits as described in the Documentation. Usage over these limits requires Customer's purchase of additional resources or services. Customer agrees that Igris Inertial, in its sole discretion and for any or no reason, may terminate Customer's access to the Free Services or any part thereof. Customer agrees that any termination of Customer's access to the Free Services may be without prior notice, and Customer agrees that Igris Inertial will not be liable to Customer or any third party for such termination.
                </p>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  NOTWITHSTANDING THE "REPRESENTATIONS, WARRANTIES, EXCLUSIVE REMEDIES AND DISCLAIMERS" SECTION AND "IGRIS INERTIAL INDEMNIFICATION" SECTION BELOW, THE FREE SERVICES ARE PROVIDED "AS-IS" WITHOUT ANY WARRANTY AND IGRIS INERTIAL SHALL HAVE NO INDEMNIFICATION OBLIGATIONS NOR LIABILITY OF ANY TYPE WITH RESPECT TO THE FREE SERVICES UNLESS SUCH EXCLUSION OF LIABILITY IS NOT ENFORCEABLE UNDER APPLICABLE LAW IN WHICH CASE IGRIS INERTIAL'S LIABILITY WITH RESPECT TO THE FREE SERVICES SHALL NOT EXCEED $100.00.
                </p>

                <h2 id="customer-data" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Customer Data</h2>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  The following applies to consumer users of the Services, inclusive of the Free and Pro plans, who have not opted-out of full authorization. Please see our Enterprise Trust Center for more information on how we handle data for Enterprise customers. Enterprise contracts are governed by a separate agreement and govern full data privacy, no authorization rights, and more data agreements.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.1 Customer Ownership</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Except for the limited rights expressly granted to Igris Inertial hereunder, Customer retains all rights, title and interest in and to all Customer Data, including without limitation all related intellectual property rights inherent therein. Customer is solely responsible for the accuracy, quality, legality, reliability, and appropriateness of all Customer Data. Customer shall ensure that it is entitled to transfer the relevant Customer Data to Igris Inertial so that Igris Inertial and its service providers may lawfully use, process, and transfer the Customer Data in accordance with this Agreement on Customer's behalf.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.2 Authorization</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Customer grants Igris Inertial a nonexclusive, worldwide, royalty-free right to reproduce, display, adapt, modify, transmit, distribute and otherwise use the Customer Data (a) to maintain, provide, and improve the Services under this Agreement; (b) to prevent or address technical or security issues and resolve support requests; (c) at Customer's direction or request, including processing initiated by Users through their use of the Platform; and (d) as otherwise required by applicable law. No rights to the Customer Data are granted to Igris Inertial hereunder other than as expressly set forth in this Agreement. For Enterprise Tier Services, Igris Inertial shall not use any Customer Data to train any Igris Inertial or third-party artificial intelligence or machine learning model, except as otherwise set forth in an applicable Order Form. For Free Services and Pro Tier Services, except as otherwise agreed to by Igris Inertial, Customer expressly grants Igris Inertial and its authorized sub-processors permission to use Customer Data to train Igris Inertial's and its authorized sub-processors' artificial intelligence and machine learning models.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.3 Aggregate and De-Identified Data</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Igris Inertial may use Customer Data to create aggregated, de-identified, and/or anonymized data sets in a manner that does not permit identification of Customer, its customers, or its Users (collectively, the "Aggregated De-Identified Data"). Igris Inertial may use Aggregated De-Identified Data for Igris Inertial's lawful business purposes, including to improve, develop, provide, and enhance the Platform and Services and for other development, diagnostic, and corrective purposes in connection with the Platform and Services and any other Igris Inertial offerings.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.4 Security</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Igris Inertial shall use commercially reasonable measures to maintain the security and integrity of the Services and the Customer Data and to provide technical and organizational safeguards against accidental, unlawful or unauthorized access to or use of, destruction, transfer, disclosure or alteration of Customer Data.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.5 Processing</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Customer shall not provide Igris Inertial with any Customer Data that constitutes Restricted Data. Igris Inertial shall have no responsibility or liability for any Restricted Data. When and as required by applicable law from time to time, Customer and Igris Inertial may enter into additional data processing agreement(s), including but not limited to those required under Article 28 of Regulation (EU) 2016/679, with respect to the processing of personally identifiable information contained within Customer Data.
                </p>

                <h2 id="restrictions" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Restrictions, Responsibilities and Rights</h2>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">4.1 Customer Restrictions</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-3">Customer shall not:</p>
                <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                  <li>modify, copy, display, republish or create derivative works based on the Services or Igris Inertial Materials;</li>
                  <li>act as a reseller or distributor of, or a service bureau for, the Platform or Services or otherwise use, exploit, make available or encumber the Platform or Services to or for the benefit of any third party;</li>
                  <li>access or use the Platform or Services without the prior written consent of Igris Inertial if Customer is or becomes a direct competitor to Igris Inertial or its affiliates;</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">4.2 Responsibilities</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Customer is responsible for maintaining the confidentiality of its account credentials and for all activities that occur under its account.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">4.3 Rights in Customer Data</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Customer retains all rights to its Customer Data. Igris Inertial acquires no rights in Customer Data except as necessary to provide the Services.
                </p>

                <h2 id="fees" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">5. Fees and Payment</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Customer shall pay Igris Inertial all fees specified in the Order Form. Fees are due in advance and non-refundable. Late payments bear interest at 1.5% per month or the maximum allowed by law.
                </p>

                <h2 id="warranties" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">6. Warranties and Disclaimers</h2>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">6.1 Igris Inertial Warranties</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Igris Inertial warrants that the Services will perform substantially as described in the Documentation. Customer's exclusive remedy for breach of this warranty is termination and refund of prepaid fees.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">6.2 Disclaimers</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Except as expressly stated, the Services are provided "as is". Igris Inertial disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
                </p>

                <h2 id="confidential" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">7. Confidential Information</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Each party agrees to maintain the confidentiality of the other party's non-public information and use it only for the purposes of this Agreement.
                </p>

                <h2 id="term" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">8. Term and Termination</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  The term of this Agreement is the Subscription Period specified in the Order Form. Subscriptions auto-renew unless canceled 30 days before renewal. Either party may terminate for material breach if not cured within 30 days.
                </p>

                <h2 id="indemnification" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">9. Indemnification</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Customer shall indemnify Igris Inertial against claims arising from Customer Data or Customer's violation of third-party rights. Igris Inertial shall indemnify Customer against claims that the Services infringe third-party IP.
                </p>

                <h2 id="liability" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">10. Limitation of Liability</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  To the fullest extent permitted by law, neither party shall be liable for indirect, incidental, special, consequential, or punitive damages. Total liability shall not exceed the amount paid by Customer in the 12 months prior to the claim.
                </p>

                <h2 id="general" className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">11. General Provisions</h2>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">11.1 Governing Law</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This Agreement is governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">11.2 Arbitration</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Any dispute arising from this Agreement shall be resolved by binding arbitration in Delaware under AAA rules. Class actions are prohibited.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">11.3 Entire Agreement</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This Agreement is the entire understanding between the parties and supersedes all prior agreements.
                </p>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-12 mb-4">Related Policy</h2>
                <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-6 space-y-2">
                  <li>
                    <a href="/terms/refund-policy" className="text-blue-600 dark:text-blue-400 hover:underline">Refund Policy</a>
                  </li>
                  <li>
                    <a href="/terms/cancellation-policy" className="text-blue-600 dark:text-blue-400 hover:underline">Cancellation Policy</a>
                  </li>
                  <li>
                    <a href="/dpa" className="text-blue-600 dark:text-blue-400 hover:underline">Data Processing Agreement (DPA)</a>
                  </li>
                </ul>

                <p className="text-gray-700 dark:text-gray-300 mt-8">
                  Contact us at <a href="mailto:support@igrisinertial.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@igrisinertial.com</a>
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
                      <a href="#definitions" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Definitions
                      </a>
                    </li>
                    <li>
                      <a href="#services" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        The Services
                      </a>
                    </li>
                    <li>
                      <a href="#customer-data" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Customer Data
                      </a>
                    </li>
                    <li>
                      <a href="#restrictions" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Restrictions & Rights
                      </a>
                    </li>
                    <li>
                      <a href="#fees" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Fees and Payment
                      </a>
                    </li>
                    <li>
                      <a href="#warranties" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Warranties
                      </a>
                    </li>
                    <li>
                      <a href="#confidential" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Confidential Info
                      </a>
                    </li>
                    <li>
                      <a href="#term" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Term & Termination
                      </a>
                    </li>
                    <li>
                      <a href="#indemnification" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Indemnification
                      </a>
                    </li>
                    <li>
                      <a href="#liability" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        Liability Limits
                      </a>
                    </li>
                    <li>
                      <a href="#general" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        General Provisions
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
