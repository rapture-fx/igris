'use client'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const FLOW_STEPS = ['Reasoning framework', 'Igris action', 'Receipt / proof']

export default function AgentStackStrip() {
  return (
    <section aria-label="Fits into your agent stack" className="bg-white dark:bg-dark-bg transition-colors duration-200">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="landing-surface-card flex flex-col gap-5 rounded-xl border border-[var(--landing-surface-border)] bg-[var(--landing-surface)] p-5 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="min-w-0 md:max-w-[52ch]">
            <h2
              className="text-black dark:text-[#f6f6f4]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(1.05rem, 1.2vw, 1.15rem)',
                fontWeight: 400,
                lineHeight: 1.35,
                letterSpacing: '-0.01em',
              }}
            >
              Fits into your agent stack
            </h2>
            <p
              className="mt-2 text-gray-600 dark:text-[#a8a898]"
              style={{
                fontFamily: MONO,
                fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
                lineHeight: 1.6,
              }}
            >
              Use your agent framework for reasoning and planning. Use Igris for the final actions
              that need policy, recovery, and receipts.
            </p>
          </div>
          <ol
            className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3"
            style={{ fontFamily: MONO }}
            aria-label="Agent stack flow"
          >
            {FLOW_STEPS.map((step, i, arr) => (
              <li key={step} className="flex items-center gap-2 md:gap-3">
                <span
                  className="whitespace-nowrap rounded-full border border-[var(--landing-surface-border)] px-3 py-1.5 text-[12px] text-black dark:text-[#f6f6f4]"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {step}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-gray-400 dark:text-[#5a5a52]" aria-hidden>
                    &rarr;
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
