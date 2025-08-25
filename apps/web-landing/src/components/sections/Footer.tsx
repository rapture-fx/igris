'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  const footerSections = [
    {
      title: "Product",
      links: [
        { name: "High-Performance Processing", href: "#high-performance-processing" },
        { name: "Multi-format Support", href: "#multi-format-support" },
        { name: "Document Extraction API", href: "#document-extraction-api" },
        { name: "Data Quality API", href: "#data-quality-api" },
        { name: "ML Pipeline API", href: "#ml-pipeline-api" },
        { name: "File Storage API", href: "#storage-api" },
        { name: "Validation API", href: "#validation-api" },
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Blog", href: "#blog" },
        { name: "Case Studies", href: "#cases" },
        { name: "Help Center", href: "#help" },
        { name: "Community", href: "#community" },
        { name: "Getting Started", href: "#getting-started" },
        { name: "API Reference", href: "#api-reference" },
        { name: "Tutorials", href: "#tutorials" },
        { name: "Best Practices", href: "#best-practices" }
      ]
    },
    {
      title: "Security",
      links: [
        { name: "Security Overview", href: "#security-overview" },
        { name: "Data Encryption", href: "#data-encryption" },
        { name: "Access Control", href: "#access-control" },
        { name: "Compliance", href: "#compliance" },
        { name: "Audit Logs", href: "#audit-logs" },
        { name: "Vulnerability Reports", href: "#vulnerability-reports" }
      ]
    },
    {
      title: "Compliance",
      links: [
        { name: "Privacy Policy", href: "#privacy" },
        { name: "Terms of Service", href: "#terms" },
        { name: "Contact", href: "#contact" },
        { name: "SOC2", href: "#" },
        { name: "GDPR", href: "#" },
        { name: "HIPAA", href: "#" },
        { name: "PCI DSS", href: "#" },
        { name: "ISO/IEC 27001:2013", href: "#" },
        { name: "NIST Cybersecurity Framework", href: "#" },
        { name: "CCPA", href: "#" },
        { name: "FedRAMP", href: "#" }
      ]
    }
  ]

  return (
    <footer className="bg-white text-gray-900">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 max-w-[1300px] mx-auto">
            {/* Brand Column */}
            <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
              <div className="flex flex-col">
                <div className="flex items-center mb-4">
                  <Image 
                    src="/new light logo Schlep-engine.svg" 
                    alt="Schlep-engine" 
                    width={32} 
                    height={32}
                  />
                  <span className="ml-2 text-lg font-bold">Schlep-engine</span>
                </div>
              </div>
            </div>

            {/* Footer Sections */}
            {footerSections.map((section, index) => (
              <div key={index} className="lg:col-span-1">
                <h3 className="text-base font-semibold mb-4 text-gray-900">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        href={link.href}
                        className="text-xs text-gray-700 hover:text-gray-900 transition-colors duration-200"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-200 pt-6 mt-12">
            <p className="text-sm text-gray-500 text-left">
              © 2024 Schlep-engine. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}