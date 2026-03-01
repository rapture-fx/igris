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
    <span className="inline-block relative align-bottom ml-3" style={{ verticalAlign: 'baseline', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: '1em', letterSpacing: '0.02em', fontWeight: 700, color: isMounted && theme === 'dark' ? '#f6f6f4' : '#1b1912' }}>
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
    <section className="pb-0 bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200" style={{ marginTop: '52px' }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden flex flex-col justify-end" style={{
          minHeight: '600px',
          marginBottom: '2rem'
        }}>
            <div className="max-w-[1100px] mx-auto w-full relative z-10 pb-10 px-4 md:px-8 lg:px-12">
            <div className="mb-1">
              <div>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8">
                  <div>
                    <h1 className="text-xl md:text-2xl lg:text-3xl mb-6" style={{ color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                      Run AI that survives failure<br />
                      and proves what it did.
                    </h1>
                    <a
                      href="https://admin.igris-inertial.com/auth?mode=signup"
                      className="inline-flex items-center justify-center px-6 py-3 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md border"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)' }}
                    >
                      Get Started
                    </a>
                  </div>
                  <div className="text-sm md:text-base lg:text-lg max-w-xs font-normal" style={{ color: mounted && theme === 'dark' ? '#a8a898' : '#6b7280', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                    <span className="block">Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere.</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
        </div>
      </div>
    </section>
  )
}
