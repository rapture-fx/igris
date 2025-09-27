'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  const footerSections = [
    {
      title: "APIs",
      links: [
        { name: "ML Pipeline", href: "http://localhost:3005/api/ml-pipeline" },
        { name: "Data Processing", href: "http://localhost:3005/api/data-processing" },
        { name: "Document Extraction", href: "http://localhost:3005/api/document-extraction" },
        { name: "Data Quality", href: "http://localhost:3005/api/data-quality" },
        { name: "File Storage", href: "http://localhost:3005/api/storage" },
        { name: "RL Optimization", href: "http://localhost:3005/api/rl-optimization" },
        { name: "Manufacturing Analytics", href: "http://localhost:3005/api/manufacturing" }
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "http://localhost:3005" },
        { name: "Getting Started", href: "http://localhost:3005/getting-started" },
        { name: "API Reference", href: "http://localhost:3005/api-reference" },
        { name: "GitHub", href: "https://github.com/schlep-engine" },
        { name: "Admin Dashboard", href: "https://admin.schlep-engine.com" },
        { name: "Support", href: "/support" }
      ]
    },
    {
      title: "Security",
      links: [
        { name: "Security Overview", href: "http://localhost:3005/security" },
        { name: "Authentication", href: "http://localhost:3005/security/auth" },
        { name: "Data Protection", href: "http://localhost:3005/security/data-protection" },
        { name: "API Security", href: "http://localhost:3005/security/api" },
        { name: "Audit Logs", href: "http://localhost:3005/security/audit-logs" },
        { name: "Report Vulnerability", href: "/security/report" }
      ]
    },
    {
      title: "Company",
      links: [
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms of Service", href: "/terms" },
        { name: "Contact", href: "/contact" },
        { name: "Documentation", href: "http://localhost:3005" },
        { name: "API Console", href: "https://console.schlep-engine.com" },
        { name: "Status", href: "/status" }
      ]
    }
  ]

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {/* Brand Column */}
            <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
              <div className="flex flex-col">
                <div className="flex items-center mb-4">
                  <Image
                    src="/Docs Schlep-engne.svg"
                    alt="Schlep-engine"
                    width={30}
                    height={30}
                  />
                </div>
              </div>
            </div>

            {/* Footer Sections */}
            {footerSections.map((section, index) => (
              <div key={index} className="lg:col-span-1">
                <h3 className="text-base font-normal mb-4 text-gray-900 dark:text-white font-inter">
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

          {/* Copyright */}
          <div className="pt-6 mt-12">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-left font-inter">
              © 2024 Schlep-engine.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}