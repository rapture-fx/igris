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
    <section className="pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-10 md:pb-10 overflow-hidden" style={{
          minHeight: '280px',
          backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f6f6f4',
          position: 'relative',
          zIndex: 1
        }}>

            <div className="max-w-[1100px] mx-auto w-full hero-top-padding">
            <div className="mb-1 text-left">
              <div>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl max-w-md" style={{ color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Run AI that survives failure and proves what it did.
                </h1>
                  <div className="text-sm md:text-base lg:text-lg max-w-md font-normal text-gray-600 dark:text-[#a8a898]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                    <span className="block">Deterministic runtime. Cloud + local fallback. Cryptographically signed execution. ROS 2 integration.</span>
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
