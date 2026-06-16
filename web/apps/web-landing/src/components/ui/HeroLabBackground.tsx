'use client'

import { useEffect, useRef } from 'react'

/**
 * Ribbon data streams for the hero lab card.
 *
 * Two separate dotted ribbons — green and blue/violet — each rendered
 * alone in its own card as straight vertical columns. Static dots only;
 * no shimmer animation.
 */

type RGB = [number, number, number]
type RibbonKind = 'green' | 'blue'

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function palette(dark: boolean) {
  return dark
    ? {
        green: [110, 185, 115] as RGB,
        greenSoft: [150, 205, 135] as RGB,
        blue: [70, 110, 225] as RGB,
        violet: [145, 115, 205] as RGB,
        streamAlpha: 1,
      }
    : {
        green: [52, 128, 70] as RGB,
        greenSoft: [80, 150, 90] as RGB,
        blue: [58, 96, 180] as RGB,
        violet: [120, 82, 165] as RGB,
        streamAlpha: 0.75,
      }
}

interface StreamDot {
  x: number
  y: number
  pre: string
  base: number
  size: number
}

interface Scene {
  dots: StreamDot[]
}

function buildScene(
  w: number,
  h: number,
  dark: boolean,
  ribbon: RibbonKind,
  contained = false,
): Scene {
  const c = palette(dark)
  const rand = mulberry32(ribbon === 'green' ? 0x16215 : 0x29a41)

  const arcStrength = 0.22
  const bgArc = (t: number) => Math.pow(t, 2.4) * arcStrength * w
  const fan = (x: number, t: number) =>
    contained ? 0 : ((x - w / 2) / (w / 2)) * bgArc(t)

  let colP = 5.5
  let cols = 13
  let x0 = ribbon === 'green' ? 0.64 * w : 0.72 * w
  const dotSize = contained ? Math.max(2, Math.min(3, w / 110)) : 2

  if (contained) {
    const pitch = Math.max(3.25, dotSize * 1.15)
    cols = Math.max(16, Math.floor((w - dotSize) / pitch) + 1)
    colP = cols > 1 ? (w - dotSize) / (cols - 1) : 0
    x0 = 0
  }
  const skipChance = contained ? 1 : 0.94

  const spec =
    ribbon === 'green'
      ? { x: x0, cols, t0: 0.0, c1: c.green, c2: c.greenSoft, a: 0.9 }
      : { x: x0, cols, t0: 0.0, c1: c.blue, c2: c.violet, a: 0.85 }

  const dots: StreamDot[] = []
  const yStart = contained ? 0 : 12
  const yEnd = h
  for (let yy = yStart; yy < yEnd; yy += 2) {
    const t = yy / h
    if (!contained && (yy / 2) % 6 === 5) continue
    const fade = contained
      ? 0.9
      : 0.55 + 0.45 * Math.pow(Math.max(0, (t - spec.t0) / (1 - spec.t0)), 1.2)
    const nCols = contained
      ? cols
      : Math.max(4, Math.round(spec.cols * (0.7 + 0.3 * t)))
    for (let ci = 0; ci < nCols; ci++) {
      const lateral = contained || (ci !== 0 && ci !== nCols - 1) ? 1 : 0.6
      if (rand() > skipChance) continue
      const tint = rand() < 0.25 ? spec.c2 : spec.c1
      const base = Math.min(
        spec.a * fade * lateral * (0.7 + 0.3 * rand()) * c.streamAlpha,
        0.95,
      )
      const xc = spec.x + ci * colP
      dots.push({
        x: xc + fan(xc, t),
        y: yy,
        pre: `rgba(${tint[0]},${tint[1]},${tint[2]},`,
        base,
        size: dotSize,
      })
    }
  }

  return { dots }
}

export default function HeroLabBackground({
  contained = false,
  ribbon = 'green',
}: {
  contained?: boolean
  ribbon?: RibbonKind
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const containedRef = useRef(contained)
  const ribbonRef = useRef(ribbon)
  containedRef.current = contained
  ribbonRef.current = ribbon

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let scene: Scene | null = null
    let w = 0
    let h = 0
    let dpr = 1

    const drawStatic = () => {
      if (!scene) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = false
      for (const d of scene.dots) {
        ctx.fillStyle = d.pre + d.base.toFixed(3) + ')'
        ctx.fillRect(d.x, d.y, d.size, d.size)
      }
    }

    const rebuild = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      if (w === 0 || h === 0) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      scene = buildScene(
        w,
        h,
        document.documentElement.classList.contains('dark'),
        ribbonRef.current,
        containedRef.current,
      )
      drawStatic()
    }

    rebuild()

    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)

    const mo = new MutationObserver(rebuild)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [contained, ribbon])

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      <canvas ref={ref} className="h-full w-full" />
      {!contained && (
        <>
          <div className="absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-white to-transparent dark:from-[#110f0f]" />
          <div className="absolute bottom-0 left-0 h-[60%] w-[58%] bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.92),transparent_72%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(17,15,15,0.88),transparent_72%)]" />
        </>
      )}
    </div>
  )
}