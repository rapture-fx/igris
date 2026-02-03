'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

const AnimatedText = () => {
  const words = ['Machines', 'AI Agents']
  const [displayText, setDisplayText] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

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
  }, [displayText, isDeleting, isPaused, wordIndex, isMounted])

  // Start the animation on mount
  useEffect(() => {
    if (isMounted && displayText === '' && !isDeleting && !isPaused) {
      const currentWord = words[wordIndex]
      setDisplayText(currentWord.slice(0, 1))
    }
  }, [isMounted])

  return (
    <span className="inline-block relative align-bottom ml-3" style={{ verticalAlign: 'baseline', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9em', letterSpacing: '0.02em', fontWeight: 500 }}>
      {isMounted ? displayText : words[0]}
      {isMounted && <span className="inline-block hero-blink">_</span>}
    </span>
  )
}

export default function Hero() {
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent dark:bg-[#1b1912] z-0 overflow-hidden border-l border-r border-gray-300 dark:border-[#f6f6f4]/5" style={{
          height: '600px',
          paddingTop: '72px'
        }}>
          {/* Background image hs.png */}
          <div className="absolute z-0" style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url(/hs.png)',
            backgroundSize: '70% auto',
            backgroundPosition: 'right bottom',
            backgroundRepeat: 'no-repeat'
          }}></div>

          <div className="max-w-[1300px] mx-auto w-full absolute z-10" style={{ bottom: '14rem', left: 0, right: 0, paddingLeft: '4rem', paddingRight: '4rem' }}>
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]">
                  The Nervous System for <AnimatedText />
                </h1>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-2xl leading-relaxed text-left mt-4">
                  A deterministic execution layer for AI that operates across cloud and devices, even when connectivity fails.
                </p>
                <div className="flex flex-wrap gap-2 md:gap-3 mt-4 text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter">
                </div>
              </div>
            </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="https://docs.igrisinertial.com/runtime/quickstart">
                  <button
                    className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 md:px-4 md:py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    Download Runtime
                  </button>
                </Link>
              </div>
          </div>
        </div>
      </div>
    </section>
  )
}
