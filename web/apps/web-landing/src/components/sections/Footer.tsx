'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Footer() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
     <footer className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12 text-[#f6f6f4]" style={{ backgroundColor: '#14120a', borderLeft: '0.5px solid #d1d5db', borderRight: '0.5px solid #d1d5db', borderBottom: '0.5px solid #d1d5db' }}>
{/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left side - Company + Features + Resources + Social */}
              <div className="flex gap-12">
                {/* Edge Features links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Edge
                  </span>
                  <Link href="/runtime#local-fallback" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Local LLM Fallback
                  </Link>
                  <Link href="/runtime#qlora" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    QLoRA Training
                  </Link>
                  <Link href="/runtime#mcp-swarm" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    MCP Swarm Mode
                  </Link>
                  <Link href="/runtime#tools" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Tool Execution
                  </Link>
                  <Link href="/runtime#planning" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Planning Agents
                  </Link>
                  <Link href="/runtime#reflection" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Reflection Agents
                  </Link>
                  <Link href="/runtime#swarm" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Multi-Agent Swarms
                  </Link>
                  <Link href="/runtime#robotics" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    ROS2 Integration
                  </Link>
                  <Link href="/runtime#federated" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Federated Learning
                  </Link>
                  <Link href="/runtime#hitl" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Human-in-the-Loop
                  </Link>
                  <Link href="/runtime#model-mgmt" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Model Management
                  </Link>
                  <Link href="/runtime#behavior-trees" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Behavior Trees
                  </Link>
                </div>

                {/* Cloud Features links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Cloud
                  </span>
                  <Link href="/overture#slo-enforcer" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    SLO Enforcer
                  </Link>
                  <Link href="/overture#cognitive-advisor" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Cognitive Advisor
                  </Link>
                  <Link href="/overture#speculative" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Speculative Execution
                  </Link>
                  <Link href="/overture#council-mode" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Council Mode
                  </Link>
                  <Link href="/overture#provider-health" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Provider Health
                  </Link>
                  <Link href="/overture#adaptive-optimization" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Adaptive Optimization
                  </Link>
                  <Link href="/overture#shadow-mode" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Shadow Mode
                  </Link>
                  <Link href="/overture#escapevector" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    EscapeVector
                  </Link>
                  <Link href="/overture#gold-code" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Gold Code
                  </Link>
                  <Link href="/overture#hotfix-blob" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Hotfix Blob
                  </Link>
                </div>

                {/* Company links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Company
                  </span>
                  <Link href="/terms" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Terms of Service
                  </Link>
                  <Link href="/privacy" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Privacy Policy
                  </Link>
                  <Link href="/cookies" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Cookie Policy
                  </Link>
                </div>

                {/* Resources links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Resources
                  </span>
                  <Link href="/pricing" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Pricing
                  </Link>
                  <Link href="/use-cases" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Use Cases
                  </Link>
                  <Link href="/blog" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Blog
                  </Link>
                  <a href="https://docs.igrisinertial.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Docs
                  </a>
                </div>

                {/* Social links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Social
                  </span>
                  <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    GitHub
                  </a>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Discord
                  </a>
                  <a href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    X (Twitter)
                  </a>
                  <a href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    LinkedIn
                  </a>
                </div>
              </div>

              {/* Logo - on right top for desktop, centered for mobile */}
              <div className="flex justify-start md:justify-end">
                <img
                  src="/dmfoot.png"
                  alt="Igris Inertial"
                  className="h-8 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6 flex items-center justify-between">
            <span className="text-sm text-[#a8a898]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              © 2026 Igris Inertial.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
