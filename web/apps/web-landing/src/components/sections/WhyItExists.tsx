'use client'

import React from 'react'

export default function WhyItExists() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 mobile-auto-height" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingTop: '2rem', paddingBottom: '2rem' }}>
          <div className="flex flex-col gap-8">
            {/* Changelog on the right side, above image */}
            <div className="flex justify-end">
              <div className="w-1/2">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg md:text-xl font-medium" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1b1912' }}>Changelog</span>
                  <a href="/changelog" className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>More Details</a>
                </div>
                <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '200px' }}>
                  <div className="flex flex-col pr-1">
                    <div className="py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                      <span className="text-xs text-gray-500 dark:text-[#a8a898] block mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Mar 2026</span>
                      <span className="text-sm text-[#000000] dark:text-[#f6f6f4] block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>v2.0 Release</span>
                      <span className="text-xs text-gray-500 dark:text-[#a8a898] block mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Behavior trees, fleet management, multi-tenancy.</span>
                    </div>
                    <div className="py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                      <span className="text-xs text-gray-500 dark:text-[#a8a898] block mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Feb 2026</span>
                      <span className="text-sm text-[#000000] dark:text-[#f6f6f4] block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>v1.9 Updates</span>
                      <span className="text-xs text-gray-500 dark:text-[#a8a898] block mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Performance improvements and bug fixes.</span>
                    </div>
                    <div className="py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                      <span className="text-xs text-gray-500 dark:text-[#a8a898] block mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Jan 2026</span>
                      <span className="text-sm text-[#000000] dark:text-[#f6f6f4] block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>v1.8 Release</span>
                      <span className="text-xs text-gray-500 dark:text-[#a8a898] block mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>MCP integration and provider health monitoring.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Image below */}
            <div>
              <div className="rounded-lg overflow-hidden relative p-4" style={{ height: 'clamp(280px, 40vw, 500px)' }}>
                <img
                  src="/rockz.png"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                  style={{ opacity: 1 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
