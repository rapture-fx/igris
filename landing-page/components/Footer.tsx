'use client'

import { motion } from 'framer-motion'
import { 
  Github, 
  Twitter, 
  Linkedin, 
  Mail, 
  MapPin, 
  Phone,
  ArrowRight
} from 'lucide-react'

export default function Footer() {
  const footerSections = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#features" },
        { name: "Pricing", href: "#pricing" },
        { name: "API Documentation", href: "/docs" },
        { name: "Integrations", href: "#integrations" },
        { name: "Security", href: "#security" },
        { name: "Changelog", href: "#changelog" }
      ]
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "#about" },
        { name: "Careers", href: "#careers" },
        { name: "Blog", href: "#blog" },
        { name: "Press Kit", href: "#press" },
        { name: "Contact", href: "#contact" },
        { name: "Partners", href: "#partners" }
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "#docs" },
        { name: "Tutorials", href: "#tutorials" },
        { name: "Community", href: "#community" },
        { name: "Status Page", href: "#status" },
        { name: "Support", href: "#support" },
        { name: "System Status", href: "#system-status" }
      ]
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy Policy", href: "#privacy" },
        { name: "Terms of Service", href: "#terms" },
        { name: "Cookie Policy", href: "#cookies" },
        { name: "GDPR", href: "#gdpr" },
        { name: "Security", href: "#security" },
        { name: "Compliance", href: "#compliance" }
      ]
    }
  ]

  const socialLinks = [
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Mail, href: "#", label: "Email" }
  ]

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto container-padding">
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-12">
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-soft-blue to-blue-600 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white font-bold text-xl">S</span>
                  </div>
                  <span className="text-2xl font-bold">Schlep Engine</span>
                </div>
                <p className="text-gray-400 mb-8 leading-relaxed">
                  Transform messy data into ML-ready formats with AI-powered 
                  data preparation. Trusted by thousands of data teams worldwide.
                </p>
                <div className="flex space-x-4">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-soft-blue transition-colors duration-200"
                      aria-label={social.label}
                    >
                      <social.icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {footerSections.map((section, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <h3 className="text-lg font-semibold mb-6">
                      {section.title}
                    </h3>
                    <ul className="space-y-4">
                      {section.links.map((link, linkIndex) => (
                        <li key={linkIndex}>
                          <a
                            href={link.href}
                            className="text-gray-400 hover:text-white transition-colors duration-200"
                          >
                            {link.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 pt-8 border-t border-gray-800"
          >
            <div className="bg-gray-800 rounded-2xl p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between">
                <div className="mb-6 lg:mb-0">
                  <h3 className="text-2xl font-bold mb-2">
                    Ready to transform your data?
                  </h3>
                  <p className="text-gray-400">
                    Join thousands of data professionals using Schlep Engine
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="#"
                    className="button-primary text-lg px-8 py-3 inline-flex items-center"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                  <a
                    href="#"
                    className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-8 py-3 rounded-xl transition-all duration-300"
                  >
                    Schedule Demo
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 pt-8 border-t border-gray-800"
          >
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="text-gray-400 mb-4 md:mb-0">
                <p>&copy; 2024 Schlep Engine. All rights reserved.</p>
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-400">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  San Francisco, CA
                </div>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  +1 (555) 123-4567
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  hello@schlepengine.com
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  )
}