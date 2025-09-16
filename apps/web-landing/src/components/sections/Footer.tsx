'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from "next-themes"
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

export default function Footer() {
  const { theme } = useTheme()
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
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 max-w-6xl mx-auto">
            {/* Brand Column */}
            <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
              <div className="flex flex-col">
                <div className="flex items-center mb-4">
                  <Image
                    src="/Docs Schlep-engne.svg"
                    alt="Schlep-engine"
                    width={40}
                    height={40}
                  />
                </div>
              </div>
            </div>

            {/* Footer Sections */}
            {footerSections.map((section, index) => (
              <div key={index} className="lg:col-span-1">
                <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white font-inter">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        href={link.href}
                        className="text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-inter"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Copyright and Theme Switcher */}
          <div className="pt-6 mt-12 flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-left font-inter">
              © 2024 Schlep-engine. All rights reserved.
            </p>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </footer>
  )
}