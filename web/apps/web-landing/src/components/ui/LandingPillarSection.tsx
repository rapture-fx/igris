'use client'

import React from 'react'

const SANS =
  'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

export interface LandingPillarSectionProps {
  id?: string
  title: string
  description?: string
  attribution?: string
  features?: string[]
  featuresLabel?: string
  children: React.ReactNode
  caption?: string
  className?: string
  titleAsPixel?: boolean
}

export function LandingPillarHeader({
  title,
  description,
  attribution,
}: Pick<LandingPillarSectionProps, 'title' | 'description' | 'attribution'>) {
  const hasAside = Boolean(description || attribution)

  return (
    <div
      className={
        hasAside
          ? 'flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-10'
          : ''
      }
    >
      <div className={hasAside ? 'min-w-0 shrink-0 md:max-w-[min(58%,600px)]' : ''}>
        <h2
          className="text-black dark:text-[#f6f6f4]"
          style={{
            fontFamily: SANS,
            fontWeight: 400,
            fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: hasAside ? undefined : '28ch',
          }}
        >
          {title}
        </h2>
        {attribution && (
          <p
            className="mt-5 max-w-[48ch] text-gray-500 dark:text-[#8a8a7a]"
            style={{
              fontFamily: MONO,
              fontSize: 'clamp(1rem, 1.3vw, 1.15rem)',
              lineHeight: 1.55,
            }}
          >
            {attribution}
          </p>
        )}
      </div>
      {description && (
        <p
          className="max-w-[42ch] text-gray-600 dark:text-[#a8a898] md:text-right"
            style={{
              fontFamily: MONO,
              fontSize: 'clamp(1rem, 1.3vw, 1.15rem)',
              lineHeight: 1.6,
            }}
          >
            {description}
        </p>
      )}
    </div>
  )
}

export function LandingFeatureList({
  features,
  label = 'Features',
}: {
  features: string[]
  label?: string
}) {
  if (!features.length) return null

  return (
    <div className="landing-pillar-features">
      <p
        className="landing-pillar-features__label text-gray-500 dark:text-[#7a7a72]"
        style={{
          fontFamily: SANS,
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <ul className="landing-pillar-features__list" style={{ fontFamily: SANS }}>
        {features.map((feature) => (
          <li key={feature} className="landing-pillar-features__item text-gray-600 dark:text-[#a8a898]">
            {feature}
          </li>
        ))}
      </ul>
      <style>{`
        .landing-pillar-features {
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr);
          gap: 12px 20px;
          align-items: start;
        }
        .landing-pillar-features__list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
        }
        .landing-pillar-features__item {
          position: relative;
          padding-left: 14px;
          font-size: clamp(0.92rem, 1vw, 1rem);
          line-height: 1.5;
          letter-spacing: -0.01em;
        }
        .landing-pillar-features__item::before {
          content: "·";
          position: absolute;
          left: 0;
          color: var(--landing-surface-muted-text);
        }
        @media (max-width: 640px) {
          .landing-pillar-features {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  )
}

export default function LandingPillarSection({
  id,
  title,
  description,
  attribution,
  features,
  featuresLabel,
  children,
  caption,
  className = '',
  titleAsPixel = false,
}: LandingPillarSectionProps) {
  return (
    <section
      id={id}
      className={
        'bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 ' +
        className
      }
    >
      <div className="pt-10 md:pt-14 pb-20 md:pb-32">
        <LandingPillarHeader
          title={title}
          description={description}
          attribution={attribution}
          titleAsPixel={titleAsPixel}
        />

        <div className="mt-10 md:mt-14">{children}</div>

        {caption && (
          <p
            className="mt-5 max-w-[52ch] text-[0.95rem] text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: SANS, lineHeight: 1.5 }}
          >
            {caption}
          </p>
        )}

        {features && features.length > 0 && (
          <div className="mt-8 md:mt-10">
            <LandingFeatureList features={features} label={featuresLabel} />
          </div>
        )}
      </div>
    </section>
  )
}