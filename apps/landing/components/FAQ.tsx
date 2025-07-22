'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      question: "What file formats do you support?",
      answer: "We support all major data formats including CSV, Excel (.xlsx, .xls), JSON, Parquet, and can connect to databases like PostgreSQL, MySQL, and MongoDB. For output, we support all major ML frameworks including TensorFlow, PyTorch, scikit-learn, and more."
    },
    {
      question: "How long does processing take?",
      answer: "Processing time depends on your data size and complexity. Most datasets under 1M rows process in under 5 minutes. Larger datasets are processed in the background with real-time progress updates. Our AI optimizes processing speed while maintaining quality."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, absolutely. We're SOC2 Type II compliant with field-level encryption both in transit and at rest. Your data is processed securely and deleted after processing unless you choose to store it. We never use your data to train our models."
    },
    {
      question: "Can I integrate with my existing ML pipeline?",
      answer: "Yes! Our REST API and SDKs (Python, JavaScript, Go) make integration simple. We also offer direct integrations with popular platforms like Jupyter, Google Colab, and cloud platforms like AWS, GCP, and Azure."
    },
    {
      question: "What happens to my data after processing?",
      answer: "By default, your original and processed data are deleted after 30 days. You can configure retention periods or immediate deletion. Enterprise customers can opt for on-premise deployment where data never leaves their infrastructure."
    },
    {
      question: "Do you offer enterprise features?",
      answer: "Yes! Enterprise features include unlimited API calls, custom AI models, on-premise deployment, SSO/SAML integration, dedicated support, custom SLAs, and advanced security features. Contact our sales team for a custom quote."
    }
  ]

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about Schlep-engine
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                onClick={() => toggleFAQ(index)}
              >
                <span className="font-semibold text-gray-900">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-700 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-[#468BE6] bg-opacity-5 rounded-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Stop Wrestling with Data?
            </h3>
            <p className="text-gray-600 mb-6">
              Join thousands of data teams who've accelerated their AI projects
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#get-started"
                className="bg-[#468BE6] text-white px-8 py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors duration-200 font-medium"
              >
                Get Started for Free
              </a>
              <a
                href="http://localhost:3001"
                className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
              >
                View Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}