'use client'

import Link from 'next/link'

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
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center mb-6" style={{gap: '0.5rem'}}>
                <img 
                  src="/Schlep Engine laest logo design.svg" 
                  alt="Schlep Engine - AI-Powered Data Preparation" 
                  className="h-10 w-auto"
                />
                <span className="text-xl" style={{fontFamily: '"DM Sans", sans-serif', color: 'white', fontWeight: '700'}}>Schlep-engine</span>
              </div>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Transform messy data into ML-ready formats with AI-powered 
                data preparation. Trusted by thousands of data teams worldwide.
              </p>
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-3 gap-8">
                {footerSections.map((section, index) => (
                  <div key={index}>
                    <h3 className="text-lg font-semibold mb-6 text-white">
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