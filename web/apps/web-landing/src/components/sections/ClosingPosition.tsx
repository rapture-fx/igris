'use client'

import React, { useState } from 'react'
import { LandingSurfaceFrame } from '../ui/ProductConsoleShell'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'
const CONSOLE_URL = 'https://console.igrisinertial.com/auth?mode=signup'

export default function ClosingPosition() {
  const [copied, setCopied] = useState(false)

  const copyInstall = () => {
    navigator.clipboard?.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <section className="bg-white text-[#171717]">
      <div className="pt-10 md:pt-14 pb-24 md:pb-40">
        <LandingSurfaceFrame>
          <div className="landing-surface-panel flex flex-col items-center text-center px-6 md:px-16 py-20 md:py-32">
            <h2
              className="text-[#171717]"
              style={{
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 'clamp(1.75rem, 4vw, 3rem)',
                lineHeight: 1.08,
                letterSpacing: '-0.04em',
                maxWidth: '28ch',
              }}
            >
              Let agents act. Keep control.
            </h2>
            <p
              className="mt-5 max-w-[44ch] text-[#6e6b62]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.2vw, 1.05rem)',
                lineHeight: 1.6,
                letterSpacing: '-0.005em',
              }}
            >
              Install Igris, register your first action, and let your agent call it — with policy, recovery, proof, and governance built in.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={CONSOLE_URL}
                className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#171717] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#383838]"
                style={{ fontFamily: SANS }}
              >
                Get API Key
              </a>
              <a
                href={DOCS_LINKS.quickstart}
                className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[rgba(0,0,0,0.08)] bg-white px-5 text-[14px] font-medium text-[#171717] transition-colors hover:bg-[#fafafa] hover:border-[rgba(0,0,0,0.12)]"
                style={{ fontFamily: SANS }}
              >
                Read the docs
              </a>
            </div>
            <div className="mt-10 flex items-center gap-2 rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-4 py-2.5">
              <code
                className="select-all text-[13px] text-[#171717]"
                style={{ fontFamily: MONO }}
              >
                {INSTALL_CMD}
              </code>
              <button
                type="button"
                onClick={copyInstall}
                className="ml-2 inline-flex h-6 items-center rounded-[4px] bg-[#171717] px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-[#383838]"
                style={{ fontFamily: SANS }}
                aria-label={copied ? 'Copied' : 'Copy install command'}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </LandingSurfaceFrame>
      </div>
    </section>
  )
}