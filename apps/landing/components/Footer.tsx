'use client'

import Link from 'next/link'
import { Github, Twitter, Linkedin, Mail } from 'lucide-react'

export default function Footer() {
  const footerSections = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#features" },
        { name: "Pricing", href: "/pricing" },
        { name: "Documentation", href: "/docs" },
        { name: "API Status", href: "#status" }
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Blog", href: "#blog" },
        { name: "Case Studies", href: "#cases" },
        { name: "Help Center", href: "#help" },
        { name: "Community", href: "#community" }
      ]
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy Policy", href: "#privacy" },
        { name: "Terms of Service", href: "#terms" },
        { name: "Security", href: "#security" },
        { name: "Contact", href: "#contact" }
      ]
    }
  ]

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center mb-6">
                <img 
                  src="/Schlep Engine 14x11cm (2).svg" 
                  alt="Schlep-engine" 
                  className="h-10 w-auto mr-3"
                />
                <span className="text-xl font-bold">Schlep-engine</span>
              </div>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Transform messy data into ML-ready formats with AI-powered 
                data preparation. Trusted by thousands of data teams worldwide.
              </p>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-[#468BE6] transition-colors duration-200"
                  aria-label="GitHub"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-[#468BE6] transition-colors duration-200"
                  aria-label="Twitter"
                >
                  <Twitter className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-[#468BE6] transition-colors duration-200"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-[#468BE6] transition-colors duration-200"
                  aria-label="Email"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-3 gap-8">
                {footerSections.map((section, index) => (
                  <div key={index}>
                    <h3 className="text-lg font-semibold mb-6">
                      {section.title}
                    </h3>
                    <ul className="space-y-4">
                      {section.links.map((link, linkIndex) => (
                        <li key={linkIndex}>
                          <Link
                            href={link.href}
                            className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                          >
                            {link.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="text-gray-400 mb-4 md:mb-0 text-sm">
                <p>&copy; 2024 Schlep-engine. All rights reserved.</p>
              </div>
              <div className="text-gray-400 text-sm">
                <p>hello@schlep-engine.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}