'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export default function Footer() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
     <footer className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12 text-gray-900 dark:text-[#f6f6f4]" style={{ backgroundColor: 'transparent' }}>
{/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left side - Company + Features + Resources + Social */}
              <div className="grid grid-cols-2 gap-6 md:flex md:gap-12">
                {/* Routing & Agents */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Routing & Agents
                  </span>
                  <Link href="/features#thompson-sampling" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Thompson Sampling
                  </Link>
                  <Link href="/features#speculative" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Speculative Execution
                  </Link>
                  <Link href="/features#council-mode" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Council Mode
                  </Link>
                  <Link href="/features#cognitive-advisor" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Cognitive Advisor
                  </Link>
                  <Link href="/features#swarm" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Multi-Agent Swarms
                  </Link>
                  <Link href="/features#behavior-trees" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Behavior Trees
                  </Link>
                  <Link href="/features#hitl" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Human-in-the-Loop
                  </Link>
                  <Link href="/features#agent-memory" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Agent Memory
                  </Link>
                  <Link href="/features#circuit-breaker" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Circuit Breaker
                  </Link>
                </div>

                {/* Infrastructure & Security */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Infrastructure & Security
                  </span>
                  <Link href="/features#local-fallback" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Local LLM Fallback
                  </Link>
                  <Link href="/features#federated" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Model Aggregation
                  </Link>
                  <Link href="/features#slo-enforcer" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    SLO Enforcer
                  </Link>
                  <Link href="/features#provider-health" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Provider Health
                  </Link>
                  <Link href="/features#fleet" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Fleet Management
                  </Link>
                  <Link href="/features#shadow-mode" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Shadow Mode
                  </Link>
                  <Link href="/features#escapevector" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    EscapeVector
                  </Link>
                  <Link href="/features#safety-containment" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Safety Containment
                  </Link>
                  <Link href="/features#byok" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    BYOK Key Vault
                  </Link>
                  <Link href="/features#mcp" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    MCP Integration
                  </Link>
                  <Link href="/features#multi-tenancy" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Multi-Tenancy
                  </Link>
                  <Link href="/features#tamper-evident" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Tamper-Evident Logs
                  </Link>
                </div>

                {/* Company links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Company
                  </span>
                  <Link href="/terms" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Terms of Service
                  </Link>
                  <Link href="/privacy" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Privacy Policy
                  </Link>
                  <Link href="/cookies" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Cookie Policy
                  </Link>
                </div>

                {/* Resources links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Resources
                  </span>
                  <Link href="/pricing" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Pricing
                  </Link>
                  <Link href="/use-cases" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Use Cases
                  </Link>
                  <Link href="/blog" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Blog
                  </Link>
                  <a href="https://docs.igrisinertial.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Docs
                  </a>
                  <Link href="/changelog" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Changelog
                  </Link>
                </div>

                {/* Social links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Social
                  </span>
                  <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    GitHub
                  </a>
                  <a href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    X (Twitter)
                  </a>
                  <a href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    LinkedIn
                  </a>
                </div>

                {/* Support links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Support
                  </span>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Discord
                  </a>
                  <a href="mailto:support@igrisinertial.com" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Contact us
                  </a>
                </div>
              </div>

              {/* Logo - on right top for desktop, centered for mobile */}
              <div className="flex justify-start md:justify-end">
                <img
                  src={mounted && theme === 'dark' ? '/inertiadm.png' : '/inertia.png'}
                  alt="Igris Inertial"
                  className="h-9 w-auto rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              © 2026 Igris Inertial.
            </span>
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle dark mode"
                className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 dark:text-[#a8a898] hover:text-gray-700 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors duration-200"
              >
                {theme === 'dark' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
