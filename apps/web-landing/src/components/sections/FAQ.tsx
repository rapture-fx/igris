'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function FAQ() {

  return (
    <section className="py-32 md:py-48 bg-gray-50 dark:bg-black relative">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 dark:from-black via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-black via-transparent to-transparent pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mt-16 text-center">
          <div>
            
            <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-10">
              Accelerate your machine learning workflows.
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <a
                href="/dashboard"
                className="bg-black text-white px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg dark:bg-[#fcfcf7] dark:text-black"
              >
                Get Started for Free
              </a>
              
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}