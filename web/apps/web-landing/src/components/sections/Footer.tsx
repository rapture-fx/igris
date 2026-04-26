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
     <footer className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12 text-gray-900 dark:text-[#f6f6f4]" style={{ backgroundColor: 'transparent' }}>
{/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left side - Company + Features + Resources + Social */}
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-6 md:flex md:gap-12">
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
                  src={mounted && theme === 'dark' ? '/inertia.png' : '/inertia.png'}
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
          </div>
        </div>
      </div>
    </footer>
  )
}
