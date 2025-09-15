'use client'
import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-white dark:bg-black pt-32 pb-16">
      <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center pt-40 font-inconsolata">
          <h1 style={{ color: '#1f53d0' }} className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight font-inconsolata">
            Messy Data to ML-ready in API Calls.
          </h1>
          <p className="text-sm md:text-base text-gray-500 mb-12 max-w-3xl mx-auto leading-relaxed font-inconsolata">Your Data-Driven Decisions, Simplified.</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              style={{ backgroundColor: '#1f53d0' }}
              className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inconsolata"
            >
              Get Started <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="http://localhost:3004"
              className="inline-flex items-center justify-center text-gray-700 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg dark:text-gray-300 dark:hover:bg-gray-800 font-inconsolata border border-gray-200 dark:border-gray-700"
            >
              API Console
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}