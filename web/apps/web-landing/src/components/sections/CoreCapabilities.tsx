import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Execution',
    description: 'Runs AI with defined limits, ensuring behavior remains predictable across devices and fleets.',
  },
  {
    name: 'Intelligence',
    description: 'Handles decision-making using language models, while execution remains structured and controlled.',
  },
  {
    name: 'Memory & Proof',
    description: 'Keeps a complete record of decisions and execution, with cryptographic verification for auditing and review.',
  },
]

export default function CoreCapabilities() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Title outside the frame */}
          <div className="flex items-end justify-between mb-4" style={{ paddingTop: '3rem', paddingBottom: '1rem' }}>
            <div className="text-left">
              <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Every layer working together
              </h3>
            </div>
            <button
              className="inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f6f6f4', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)' }}
            >
              Learn More
            </button>
          </div>
          
          {/* Frame with centered cards */}
          <div className="rounded-2xl flex items-center justify-center relative overflow-hidden core-cards-frame" style={{ height: '600px', marginBottom: '4rem' }}>
            <img
              src="/arc.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-0 rounded-2xl"
              style={{ opacity: 0.9 }}
            />
            <div className="flex flex-col md:flex-row gap-4 z-10 w-full md:w-auto px-4 md:px-0 py-8 md:py-0">
              {capabilities.map((capability, index) => (
                <React.Fragment key={capability.name}>
                   <div className="bg-[#f6f6f4] dark:bg-[#1b1912] border border-gray-300 dark:border-[#f6f6f4]/10 rounded-2xl w-full md:w-[280px] shadow-md flex flex-col" style={{ minHeight: '380px' }}>
                    <div className="flex-1" style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {index === 0 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cr.png' : '/exc.png'}
                          alt={capability.name}
                          style={{
                            width: '85%',
                            height: '85%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                      {index === 1 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cs.png' : '/tre.png'}
                          alt={capability.name}
                          style={{
                            width: '85%',
                            height: '85%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                      {index === 2 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cc.png' : '/one.png'}
                          alt={capability.name}
                          style={{
                            width: '85%',
                            height: '85%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                    </div>
                    <div className="p-6 pt-4 mt-auto">
                      <h4 className="text-base md:text-lg mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                        {capability.name}
                      </h4>
                      <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: 'var(--font-geist-sans)' }}>
                        {capability.description}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
