'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

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
        // Typing phase
        if (displayText.length < currentWord.length) {
          setDisplayText(currentWord.slice(0, displayText.length + 1))
        } else {
          // Finished typing, pause before deleting
          setIsPaused(true)
          setTimeout(() => {
            setIsPaused(false)
            setIsDeleting(true)
          }, pauseDuration)
        }
      } else {
        // Deleting phase
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1))
        } else {
          // Finished deleting, move to next word
          setIsDeleting(false)
          setWordIndex((prev) => (prev + 1) % words.length)
        }
      }
    }, typingSpeed)

    return () => clearTimeout(timer)
  }, [displayText, isDeleting, isPaused, wordIndex, isMounted, theme])

  // Start the animation on mount
  useEffect(() => {
    if (isMounted && displayText === '' && !isDeleting && !isPaused) {
      const currentWord = words[wordIndex]
      setDisplayText(currentWord.slice(0, 1))
    }
  }, [isMounted])

  return (
    <span className="inline-block relative align-bottom ml-3" style={{ verticalAlign: 'baseline', fontFamily: 'var(--font-geist-pixel-square)', fontSize: '1em', letterSpacing: '0.02em', fontWeight: 700, color: isMounted && theme === 'dark' ? '#f6f6f4' : '#1b1912' }}>
      {isMounted ? displayText : words[0]}
      {isMounted && <span className="inline-block hero-blink" style={{ color: isMounted && theme === 'dark' ? '#f6f6f4' : '#1b1912' }}>_</span>}
    </span>
  )
}

export default function Hero() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-16 md:pb-16 overflow-hidden" style={{
          minHeight: '400px',
          backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f6f6f4',
          position: 'relative',
          zIndex: 1
        }}>

            <div className="max-w-[1100px] mx-auto w-full hero-top-padding">
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold" style={{ color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', fontFamily: 'var(--font-geist-pixel-square)' }}>
                  <span className="block mb-3">The Nervous System</span>
                  <span className="block">for <AnimatedText /></span>
                </h1>
                <div className="flex flex-wrap gap-2 md:gap-3 mt-8 text-xs md:text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace", color: mounted && theme === 'dark' ? '#a8a898' : '#6a6a6a' }}>
                </div>
              </div>
            </div>

                <div className="flex flex-wrap gap-4 mt-8">
                  <Link href="https://docs.igrisinertial.com/runtime/quickstart">
                    <button
                      className="inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md"
                      style={{ backgroundColor: '#14120a', color: '#f6f6f4' }}
                    >
                      Download
                    </button>
                  </Link>
                  <Link href="https://github.com/igris-inertial">
                    <button
                      className="inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border"
                      style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f6f6f4', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)' }}
                    >
                      GitHub
                    </button>
                  </Link>
                </div>
            </div>
        </div>
      </div>
    </section>
  )
}
