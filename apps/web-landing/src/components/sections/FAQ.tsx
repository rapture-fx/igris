'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function FAQ() {

  return (
    <section className="py-16 md:py-24 bg-[#161616]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-16 text-center">
          <div>
            <img 
              src="/Schlep Engine laest logo design.svg" 
              alt="Schlep Engine Logo" 
              className="h-40 w-auto mx-auto mb-10"
            />
            <h3 className="text-4xl font-bold text-beige-secondary mb-10">
              Accelerate your machine learning workflows.
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <a
                href="#get-started"
                className="bg-[#1A5799] text-beige-secondary px-5 py-2.5 rounded-xl hover:bg-[#154A85] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
              >
                Get Started for Free
              </a>
              <a
                href="http://localhost:3001"
                className="bg-beige-secondary text-custom-gray px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
              >
                View Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}