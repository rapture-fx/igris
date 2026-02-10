'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export default function Footer() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
     <footer className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12 text-gray-900 dark:text-[#f6f6f4]" style={{ backgroundColor: 'transparent' }}>
{/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left side - Company + Features + Resources + Social */}
              <div className="grid grid-cols-2 gap-6 md:flex md:gap-12">
                {/* Routing & Agents */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Routing & Agents
                  </span>
                  <Link href="/features#thompson-sampling" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Thompson Sampling
                  </Link>
                  <Link href="/features#speculative" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Speculative Execution
                  </Link>
                  <Link href="/features#council-mode" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Council Mode
                  </Link>
                  <Link href="/features#cognitive-advisor" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Cognitive Advisor
                  </Link>
                  <Link href="/features#planning" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Planning Agents
                  </Link>
                  <Link href="/features#reflection" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Reflection Agents
                  </Link>
                  <Link href="/features#swarm" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Multi-Agent Swarms
                  </Link>
                  <Link href="/features#behavior-trees" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Behavior Trees
                  </Link>
                </div>

                {/* Infrastructure & Security */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Infrastructure & Security
                  </span>
                  <Link href="/features#local-fallback" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Local LLM Fallback
                  </Link>
                  <Link href="/features#qlora" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    QLoRA Training
                  </Link>
                  <Link href="/features#federated" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Federated Learning
                  </Link>
                  <Link href="/features#slo-enforcer" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    SLO Enforcer
                  </Link>
                  <Link href="/features#provider-health" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Provider Health
                  </Link>
                  <Link href="/features#fleet" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Fleet Management
                  </Link>
                  <Link href="/features#shadow-mode" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Shadow Mode
                  </Link>
                  <Link href="/features#escapevector" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    EscapeVector
                  </Link>
                  <Link href="/features#gold-code" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Gold Code
                  </Link>
                </div>

                {/* Company links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Company
                  </span>
                  <Link href="/terms" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Terms of Service
                  </Link>
                  <Link href="/privacy" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Privacy Policy
                  </Link>
                  <Link href="/cookies" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Cookie Policy
                  </Link>
                </div>

                {/* Resources links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Resources
                  </span>
                  <Link href="/pricing" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Pricing
                  </Link>
                  <Link href="/use-cases" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Use Cases
                  </Link>
                  <Link href="/blog" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Blog
                  </Link>
                  <a href="https://docs.igrisinertial.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Docs
                  </a>
                  <Link href="/changelog" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Changelog
                  </Link>
                </div>

                {/* Social links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Social
                  </span>
                  <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    GitHub
                  </a>
                  <a href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    X (Twitter)
                  </a>
                  <a href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    LinkedIn
                  </a>
                </div>

                {/* Support links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Support
                  </span>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Discord
                  </a>
                  <a href="mailto:support@igrisinertial.com" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Contact us
                  </a>
                </div>
              </div>

              {/* Logo - on right top for desktop, centered for mobile */}
              <div className="flex justify-start md:justify-end">
                <img
                  src={mounted && theme === 'dark' ? '/dmfoot.png' : '/foot.png'}
                  alt="Igris Inertial"
                  className="h-8 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              © 2026 Igris Inertial.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
