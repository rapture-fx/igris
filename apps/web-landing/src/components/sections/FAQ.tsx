'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function FAQ() {

  return (
    <section className="py-32 md:py-48 bg-gray-50 relative">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/above the footer.svg')" }}></div>
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent pointer-events-none"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mt-16 text-center">
          <div>
            
            <h3 className="text-4xl font-bold text-gray-900 mb-10">
              Accelerate your machine learning workflows.
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <a
                href="/dashboard"
                className="bg-[#1A5799] text-white px-5 py-2.5 rounded-xl hover:bg-[#154A85] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
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