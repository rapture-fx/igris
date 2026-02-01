'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

const AnimatedText = () => {
  const words = ['Machines', 'AI Agents']
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const currentWord = words[currentWordIndex]

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (currentText.length < currentWord.length) {
          setCurrentText(currentWord.slice(0, currentText.length + 1))
        } else {
          // Wait before deleting
          setTimeout(() => setIsDeleting(true), 2000)
        }
      } else {
        // Deleting
        if (currentText.length > 0) {
          setCurrentText(currentText.slice(0, -1))
        } else {
          // Move to next word
          setIsDeleting(false)
          setCurrentWordIndex((prev) => (prev + 1) % words.length)
        }
      }
    }, isDeleting ? 50 : 100)

    return () => clearTimeout(timeout)
  }, [currentText, isDeleting, currentWordIndex])

  return (
    <span className="inline-block relative align-bottom" style={{ verticalAlign: 'baseline' }}>
      {currentText}
      <span className="inline-block animate-blink">_</span>
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </span>
  )
}

export default function Hero() {
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent dark:bg-[#1b1912] z-0 overflow-hidden border-l border-r border-gray-300 dark:border-[#f6f6f4]/5" style={{
          height: '650px',
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

          <div className="max-w-[1300px] mx-auto w-full absolute z-10" style={{ bottom: '5rem', left: 0, right: 0, paddingLeft: '4rem', paddingRight: '4rem' }}>
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]">
                  The Nervous System for <AnimatedText /><br />That Can't Fail
                </h1>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-2xl leading-relaxed text-left mt-4">
                  Deterministic AI execution with cryptographic provenance. Run GGUF models on hardware or servers with hard resource limits and signed outputs. Prove every decision. Survive offline. Scale when connected.
                </p>
                <div className="flex flex-wrap gap-2 md:gap-3 mt-4 text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter">
                  <span>16MB binary</span>
                  <span>·</span>
                  <span>Deterministic execution</span>
                  <span>·</span>
                  <span>Cryptographic signing</span>
                  <span>·</span>
                  <span>Offline-first</span>
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
