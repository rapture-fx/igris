'use client'

import React from 'react'

export default function WhyItExists() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 mobile-auto-height" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingTop: '2rem', paddingBottom: '2rem' }}>
          <div className="flex gap-8">
            {/* Left column - Image (wider) */}
            <div className="w-2/3">
              <div className="rounded-2xl overflow-hidden relative p-4" style={{ height: 'clamp(280px, 40vw, 500px)' }}>
                <img
                  src="/rockz.png"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  style={{ opacity: 1 }}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="w-1/3 flex flex-col gap-8">
              {/* Latest Updates - Card Style per item */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1b1912' }}>Latest Updates</span>
                  <a href="/blog" className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>More Articles</a>
                </div>
                <div className="relative">
                  <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '260px' }}>
                    <div className="flex flex-col gap-3 pr-1 pb-4">
                      <div className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-4 bg-[#f9f9fa] dark:bg-[#1b1912]/60">
                        <span className="text-sm text-[#000000] dark:text-[#f6f6f4] block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Runtime v2.1: Model Hot-Swapping</span>
                        <span className="text-xs text-gray-500 dark:text-[#a8a898] block mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Swap models at runtime without downtime. Improved containment bounds for edge deployments.</span>
                      </div>
                      <div className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-4 bg-[#f9f9fa] dark:bg-[#1b1912]/60">
                        <span className="text-sm text-[#000000] dark:text-[#f6f6f4] block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Overture v2.0: Thompson Sampling</span>
                        <span className="text-xs text-gray-500 dark:text-[#a8a898] block mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Adaptive routing that learns from provider performance. Real-time health monitoring.</span>
                      </div>
                      <div className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-4 bg-[#f9f9fa] dark:bg-[#1b1912]/60">
                        <span className="text-sm text-[#000000] dark:text-[#f6f6f4] block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Behavior Trees: Visual Editor</span>
                        <span className="text-xs text-gray-500 dark:text-[#a8a898] block mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Define agent workflows with sequence, selector, and action nodes. YAML support included.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Changelog - Dash Style Dividers */}
              <div>
                <span className="text-xs font-medium uppercase tracking-wider mb-4 block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1b1912' }}>Changelog</span>
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
          </div>
        </div>
      </div>
    </section>
  )
}
