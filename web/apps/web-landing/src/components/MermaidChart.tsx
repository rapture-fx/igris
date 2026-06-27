'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: object) => void
      render: (id: string, text: string) => Promise<{ svg: string }>
    }
  }
}

interface MermaidChartProps {
  chart: string
  className?: string
}

export function MermaidChart({ chart, className = '' }: MermaidChartProps) {
  const [svg, setSvg] = useState('')
  const [scriptReady, setScriptReady] = useState(false)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!scriptReady || !window.mermaid) return
    let cancelled = false

    window.mermaid.initialize({
      startOnLoad: false,
      fontFamily: 'inherit',
    })

    window.mermaid
      .render(idRef.current, chart.trim())
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [chart, scriptReady])

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
      />
      {svg ? (
        <div
          className={`overflow-x-auto rounded-lg border border-[#ebebeb] bg-[#fafafa] p-6 [&_svg]:mx-auto ${className}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-lg border border-[#ebebeb] bg-[#fafafa] p-10 text-sm text-[#8f8f8f] ${className}`}
        >
          Loading diagram…
        </div>
      )}
    </>
  )
}