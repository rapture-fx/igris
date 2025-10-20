import React from 'react'
import Link from 'next/link'

export default function TechStack() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40 relative" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto">
            {/* Section Title */}
            <div className="text-left mb-12">
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">How It Works</h2>
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                Intelligent Routing.<br/>Zero configuration optimization.
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Schlep Engine automatically optimizes AI inference requests across providers, learning from performance data to deliver the best results without manual intervention.
              </p>
            </div>

            {/* Placeholder Stack - Vertical Layout */}
            <div className="space-y-8 mt-8">
              {/* Top - Diagram */}
              <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 min-h-[400px] bg-cover bg-center relative shadow-lg hover:shadow-xl transition-all duration-300" style={{backgroundImage: 'url(/bgright.svg)'}}>
                <div className="relative z-10 flex items-center justify-center h-full p-8">
                  <img src="/How it works diagram.svg" alt="How It Works Diagram" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
              
              {/* Bottom - Legend and Values */}
              <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden card-hover shadow-lg hover:shadow-xl transition-all duration-300" style={{ 
                backgroundColor: '#f2f1ed',
                position: 'relative'
              }}>
                <div className="relative z-10 p-8">
                  {/* Legend Section */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-2" style={{ color: '#0E1E40', fontFamily: 'Inter, sans-serif' }}>Legend</h3>
                    <p className="text-sm text-gray-600 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>How to read the diagram</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🩵</span>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#333333', fontFamily: 'Inter, sans-serif' }}>Client & Gateway</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>Request entry point</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🟣</span>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#333333', fontFamily: 'Inter, sans-serif' }}>Intelligent Routing Layer</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>Policy selection and request optimization</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🟠</span>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#333333', fontFamily: 'Inter, sans-serif' }}>Adaptive Learning Core</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>Optimizes latency, cost, and quality</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🟢</span>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#333333', fontFamily: 'Inter, sans-serif' }}>Provider Layer</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>Executes inference across LLM APIs</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">💛</span>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#333333', fontFamily: 'Inter, sans-serif' }}>Observability & Control</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>Tracks metrics and enables live tuning</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Value Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-6" style={{ color: '#0E1E40', fontFamily: 'Inter, sans-serif' }}>Why It Matters</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⚙️</span>
                        <div className="font-medium text-sm" style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                          Zero configuration setup
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🧠</span>
                        <div className="font-medium text-sm" style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                          Self-learning optimizer
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🌐</span>
                        <div className="font-medium text-sm" style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                          Multi-provider compatible
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📊</span>
                        <div className="font-medium text-sm" style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                          Fully observable system
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Diagonal pattern overlay */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-[0.05]"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, transparent, transparent 48%, rgba(255,255,255,0.1) 49%, rgba(255,255,255,0.1) 51%, transparent 52%, transparent),
                      linear-gradient(-45deg, transparent, transparent 48%, rgba(255,255,255,0.1) 49%, rgba(255,255,255,0.1) 51%, transparent 52%, transparent)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
