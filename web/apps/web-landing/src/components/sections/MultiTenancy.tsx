import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const features = [
  {
    title: 'Signed execution',
    description: 'Every decision is recorded and cryptographically signed. Execution traces can be verified independently — without relying on our control plane.',
  },
  {
    title: 'Fail-safe execution',
    description: 'Resource limits are enforced at runtime. Memory, CPU, and execution time are bounded. If limits are exceeded, the process terminates cleanly. No leaks. No undefined behavior.',
  },
  {
    title: 'Air-gapped operation',
    description: 'Runs independently of network access. Execution continues even when connectivity does not.',
  },
  {
    title: 'Zero-trust enrollment',
    description: 'Each device authenticates cryptographically before joining a fleet. No implicit trust. Compromised systems are rejected automatically.',
  },
  {
    title: 'Device-bound encryption',
    description: 'Models and execution data are encrypted and bound to specific hardware. If a device is lost, its data remains inaccessible.',
  },
  {
    title: 'Verified updates',
    description: 'Model and configuration changes require valid cryptographic signatures. Unsigned or altered artifacts are rejected before execution.',
  },
  {
    title: 'Tamper-evident history',
    description: 'Execution records include anti-replay protections and integrity checks. Any modification is detectable.',
  },
]

export default function MultiTenancy() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 overflow-hidden">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Title */}
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              Proof is built in
            </h3>
            <Link
              href="/security"
              className="inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md border shrink-0 ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f6f6f4', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Learn More
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Bento grid: 3 on top, 4 on bottom */}
          <div className="flex flex-col gap-4" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            {/* Top row - 3 items */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.slice(0, 3).map((feature) => (
                <div key={feature.title} className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-6 bg-[#edece9] dark:bg-[#1b1912]/60 hover:border-gray-300 dark:hover:border-[#f6f6f4]/15 transition-colors duration-200 min-h-[280px] flex flex-col">
                  <h4 className="text-base md:text-lg text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {feature.title}
                  </h4>
                  <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mt-auto" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom row - 4 items */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {features.slice(3).map((feature) => (
                <div key={feature.title} className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-6 bg-[#edece9] dark:bg-[#1b1912]/60 hover:border-gray-300 dark:hover:border-[#f6f6f4]/15 transition-colors duration-200 min-h-[280px] flex flex-col">
                  <h4 className="text-base md:text-lg text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {feature.title}
                  </h4>
                  <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mt-auto" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
