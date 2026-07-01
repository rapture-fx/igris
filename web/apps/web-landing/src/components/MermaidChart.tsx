'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { renderMermaidChart } from '../lib/mermaid-loader'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const VISION_EASE = [0.16, 1, 0.3, 1] as const

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: object) => void
      render: (id: string, text: string) => Promise<{ svg: string }>
    }
  }
}

type MermaidVariant = 'default' | 'featured'

interface MermaidChartProps {
  chart: string
  className?: string
  variant?: MermaidVariant
  /** When false, skip fade-in so pre-rendered diagrams appear instantly on open. */
  animateIn?: boolean
}

function getMermaidConfig(variant: MermaidVariant) {
  if (variant === 'featured') {
    return {
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: SANS,
        fontSize: '14px',
        primaryColor: '#ffffff',
        primaryTextColor: '#171717',
        primaryBorderColor: '#d4d4d4',
        secondaryColor: '#ecf5ed',
        secondaryTextColor: '#047857',
        secondaryBorderColor: '#b8dfc4',
        tertiaryColor: '#fdf4f4',
        tertiaryTextColor: '#be123c',
        tertiaryBorderColor: '#f0c4c4',
        lineColor: '#c4c4c4',
        textColor: '#171717',
        mainBkg: '#ffffff',
        nodeBorder: '#d4d4d4',
        clusterBkg: '#fafafa',
        clusterBorder: '#ebebeb',
        titleColor: '#8f8f8f',
        edgeLabelBackground: '#ffffff',
      },
      flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 44,
        rankSpacing: 52,
        htmlLabels: true,
        useMaxWidth: true,
        wrappingWidth: 220,
      },
    }
  }

  return {
    startOnLoad: false,
    theme: 'neutral',
    fontFamily: 'inherit',
    flowchart: { curve: 'basis', padding: 20 },
  }
}

function polishFeaturedSvg(svg: string): string {
  return svg
    .replace(/<rect([^>]*class="[^"]*node[^"]*"[^>]*)>/g, (match, attrs) => {
      if (/rx=/.test(attrs)) return match
      return `<rect${attrs} rx="10" ry="10">`
    })
    .replace(/<rect([^>]*class="[^"]*cluster[^"]*"[^>]*)>/g, (match, attrs) => {
      if (/rx=/.test(attrs)) return match
      return `<rect${attrs} rx="12" ry="12">`
    })
}

const VARIANT_STYLES: Record<MermaidVariant, { shell: string; loading: string; svg: string }> = {
  default: {
    shell: 'overflow-x-auto rounded-lg border border-[#ebebeb] bg-white p-6',
    loading: 'flex items-center justify-center rounded-lg border border-[#ebebeb] bg-white p-10 text-sm text-[#8f8f8f]',
    svg: '[&_svg]:mx-auto',
  },
  featured: {
    shell: 'min-h-[22rem] overflow-x-auto bg-[#fcfcfc] px-4 py-6 sm:px-6 sm:py-8',
    loading: 'flex min-h-[22rem] items-center justify-center bg-[#fcfcfc] px-4 py-8 text-sm text-[#8f8f8f]',
    svg: [
      '[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[36rem]',
      '[&_svg_text]:fill-[#171717]',
      '[&_svg_.edgeLabel_text]:fill-[#52525b]',
      '[&_svg_.edgeLabel_rect]:fill:#ffffff',
      '[&_svg_.edgeLabel_rect]:stroke:#ebebeb',
      '[&_svg_.cluster-label_text]:fill-[#8f8f8f]',
      '[&_svg_.cluster-label_text]:font-size:11px',
      '[&_svg_.cluster-label_text]:letter-spacing:0.08em',
      '[&_svg_.cluster rect]:fill:#fafafa',
      '[&_svg_.cluster rect]:stroke:#ebebeb',
      '[&_svg_path.flowchart-link]:stroke-[#c4c4c4]',
      '[&_svg_path.flowchart-link]:stroke-width:1.5px',
      '[&_svg_path]:stroke-linecap-round',
      '[&_svg_marker_path]:fill-[#c4c4c4]',
      '[&_svg_foreignObject_span]:font-family:var(--font-geist-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      '[&_svg_foreignObject_span]:line-height:1.35',
    ].join(' '),
  },
}

export function MermaidChart({
  chart,
  className = '',
  variant = 'default',
  animateIn = true,
}: MermaidChartProps) {
  const [svg, setSvg] = useState('')
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)
  const reducedMotion = useReducedMotion()
  const styles = VARIANT_STYLES[variant]
  const shouldAnimateIn = animateIn && !reducedMotion && Boolean(svg)

  useEffect(() => {
    let cancelled = false

    renderMermaidChart(chart, variant, idRef.current, (mermaid) => {
      mermaid.initialize(getMermaidConfig(variant))
    })
      .then((rendered) => {
        if (!cancelled) {
          setSvg(variant === 'featured' ? polishFeaturedSvg(rendered) : rendered)
        }
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [chart, variant])

  if (svg) {
    const content = (
      <div
        className={`${styles.shell} ${styles.svg} ${className}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    )

    if (!shouldAnimateIn) return content

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.42, ease: VISION_EASE }}
      >
        {content}
      </motion.div>
    )
  }

  return (
    <div className={`${styles.loading} ${className}`} aria-busy="true" aria-label="Loading diagram">
      <div className="flex w-full max-w-md flex-col items-center gap-3 px-6" aria-hidden>
        <div className="h-10 w-48 rounded-[10px] bg-[#f4f4f5]" />
        <div className="h-24 w-full rounded-[10px] bg-[#f4f4f5]" />
        <div className="h-10 w-40 rounded-[10px] bg-[#f4f4f5]" />
      </div>
      <span className="sr-only">Loading diagram</span>
    </div>
  )
}