'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -sSL https://igrisinertial.com/install | bash'

const AnimatedText = () => {
  const words = ['Machines', 'AI Agents']
  const [displayText, setDisplayText] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || isPaused) return

    const currentWord = words[wordIndex]
    const typingSpeed = isDeleting ? 50 : 100
    const pauseDuration = 2000

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentWord.length) {
          setDisplayText(currentWord.slice(0, displayText.length + 1))
        } else {
          setIsPaused(true)
          setTimeout(() => {
            setIsPaused(false)
            setIsDeleting(true)
          }, pauseDuration)
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1))
        } else {
          setIsDeleting(false)
          setWordIndex((prev) => (prev + 1) % words.length)
        }
      }
    }, typingSpeed)

    return () => clearTimeout(timer)
  }, [displayText, isDeleting, isPaused, wordIndex, isMounted, theme])

  useEffect(() => {
    if (isMounted && displayText === '' && !isDeleting && !isPaused) {
      const currentWord = words[wordIndex]
      setDisplayText(currentWord.slice(0, 1))
    }
  }, [isMounted])

  return (
    <span className="inline-block relative align-bottom ml-3" style={{ verticalAlign: 'baseline', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: '1em', letterSpacing: '0.02em', fontWeight: 700, color: isMounted && theme === 'dark' ? '#f6f6f4' : '#1b1912' }}>
      {isMounted ? displayText : words[0]}
      {isMounted && <span className="inline-block hero-blink" style={{ color: isMounted && theme === 'dark' ? '#f6f6f4' : '#1b1912' }}>_</span>}
    </span>
  )
}

export default function Hero() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <section className="pb-0 bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200" style={{ marginTop: '52px' }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden flex flex-col justify-center min-h-[auto] md:min-h-[calc(100vh-52px)]" style={{
          marginBottom: '2rem'
        }}>
          <div className="max-w-[1100px] mx-auto w-full relative z-10 pb-10 px-4 md:px-8 lg:px-12">
            <div className="flex flex-col gap-8">
              {/* Top row: Title left, Subtext right */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="text-left">
                  <h1 className="text-xl md:text-3xl lg:text-4xl mb-2 leading-tight" style={{ color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)', fontWeight: 700 }}>
                    Run AI that survives failure<br />
                    <span className="mt-2 block">and proves what it did.</span>
                  </h1>
                </div>
                <div className="text-left md:text-right" style={{ maxWidth: '300px' }}>
                  <p className="text-sm md:text-base" style={{ color: mounted && theme === 'dark' ? '#a8a898' : '#6b7280', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                    Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere.
                  </p>
                </div>
              </div>

              {/* Image centered */}
              <div className="flex justify-center" style={{ marginBottom: '2rem' }}>
                <img src="/hjk.png" alt="Hero" className="max-w-full h-auto w-full md:w-auto" style={{ maxWidth: '500px' }} />
              </div>

              {/* Buttons below */}
              <div className="flex flex-col md:flex-row items-center gap-4 justify-center">
<a
                    href="https://admin.igris-inertial.com/auth?mode=signup"
                    className="inline-flex items-center justify-center px-6 py-3 hover:opacity-80 transition-all duration-200 text-sm shadow-[0_4px_14px_rgba(0,0,0,0.3)] rounded-md"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#000000', color: '#ffffff' }}
                  >
                    Get Started
                  </a>
<div
                    className="inline-flex items-center gap-4 rounded-md px-6 py-3 text-sm border shadow-[0_4px_14px_rgba(0,0,0,0.15)]"
                    style={{
                      backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#ffffff',
                      borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : 'rgba(0,0,0,0.1)',
                      color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151',
                    }}
                  >
                    <span className="select-all">{INSTALL_CMD}</span>
                    <button
                      onClick={copy}
                      className="shrink-0 transition-opacity hover:opacity-60"
                      title={copied ? 'Copied' : 'Copy'}
                      style={{ color: mounted && theme === 'dark' ? '#a8a898' : '#6b7280' }}
                    >
                      {copied ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </section>
  )
}
