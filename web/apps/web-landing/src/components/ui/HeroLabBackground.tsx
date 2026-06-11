'use client'

import { useEffect, useRef } from 'react'

/**
 * Execution-lab telemetry background for the hero.
 *
 * A receding instrument floor: a perspective grid of tiny dot-matrix
 * glyph clusters (sparse and dim at the top, dense and bright up close)
 * crossed by two curved "data streams" — a green ribbon and a
 * blue/violet ribbon side by side on the right — that run continuously at the bottom and
 * fragment into detached row-blocks as they recede. The streams carry a
 * slow downward shimmer, like data flowing through the floor; a few
 * glyph cells blink as instrument readouts. Static glyphs are cached on
 * an offscreen layer; only stream dots and blips are repainted (~30fps),
 * and everything renders once when reduced motion is requested.
 */

type RGB = [number, number, number]

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
        glyph: [202, 200, 188] as RGB,
        glyphWarm: [214, 188, 152] as RGB,
        glyphCool: [164, 188, 218] as RGB,
        glyphAlpha: 1,
        green: [110, 185, 115] as RGB,
        greenSoft: [150, 205, 135] as RGB,
        blue: [70, 110, 225] as RGB,
        violet: [145, 115, 205] as RGB,
        streamAlpha: 1,
      }
    : {
        glyph: [70, 68, 60] as RGB,
        glyphWarm: [120, 95, 55] as RGB,
        glyphCool: [60, 80, 115] as RGB,
        glyphAlpha: 0.75,
        green: [52, 128, 70] as RGB,
        greenSoft: [80, 150, 90] as RGB,
        blue: [58, 96, 180] as RGB,
        violet: [120, 82, 165] as RGB,
        streamAlpha: 0.75,
      }
}

interface Row {
  y: number
  t: number
  scale: number
  rh: number
}

function buildRows(h: number): Row[] {
  const rows: Row[] = []
  for (let y = 12; y < h + 30; ) {
    const t = Math.min(y / h, 1)
    const scale = 0.62 + 0.75 * t
    const rh = 24 * scale
    rows.push({ y, t, scale, rh })
    y += rh
  }
  return rows
}

interface StreamDot {
  x: number
  y: number
  t: number // 0 top → 1 bottom, drives the travelling shimmer
  pre: string // "rgba(r,g,b," — alpha appended per frame
  base: number
  phase: number // per-strip offset so bundles don't pulse in sync
  size: number
}

interface Blip {
  x: number
  y: number
  pitch: number
  dot: number
  pre: string
  period: number
  offset: number
  mask: number[] // lit cells of a 3x5 mini-glyph
}

interface Scene {
  layer: HTMLCanvasElement
  dots: StreamDot[]
  blips: Blip[]
}

function buildScene(w: number, h: number, dpr: number, dark: boolean): Scene {
  const c = palette(dark)
  const rand = mulberry32(0x16215)

  const layer = document.createElement('canvas')
  layer.width = Math.round(w * dpr)
  layer.height = Math.round(h * dpr)
  const ctx = layer.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const rows = buildRows(h)

  // identical sweep to the data streams so the whole floor bends as one
  const bgArc = (t: number) => Math.pow(t, 3) * 0.13 * w

  // ---- glyph floor (cached) ----------------------------------------------
  const cellW = 44
  // rows shear right as they descend, so start columns left of the edge
  // to keep the bottom-left corner covered
  const shearCols = Math.ceil(bgArc(1) / cellW)
  for (const row of rows) {
    const pitch = 2.8 * row.scale
    const dot = 1.5 + 0.6 * row.t
    const cols = Math.ceil(w / cellW) + 1
    const colWeight = [1.0, 0.4, 0.9, 0.35]
    for (let col = -shearCols; col < cols; col++) {
      const gx = col * cellW + 14 + bgArc(row.t) + (rand() - 0.5) * 3
      const density = 0.24 + 0.55 * Math.pow(row.t, 1.2) + (rand() - 0.5) * 0.12
      const roll = rand()
      const tint = roll < 0.06 ? c.glyphCool : roll < 0.11 ? c.glyphWarm : c.glyph
      for (let sx = 0; sx < 4; sx++) {
        for (let sy = 0; sy < 5; sy++) {
          if (rand() > density * colWeight[sx]) continue
          const a = (0.22 + 0.18 * row.t) * (0.55 + 0.45 * rand()) * c.glyphAlpha
          ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${a.toFixed(3)})`
          ctx.fillRect(gx + sx * pitch, row.y + sy * pitch, dot, dot)
        }
      }
    }
  }

  // ---- data streams ---------------------------------------------------------
  // One dotted ribbon per color — fine vertical columns ~2px wide on a
  // ~5.5px pitch, near-solid vertically — running the full height of the
  // hero, anchored close together on the right. Both ribbons share the
  // exact same sweep as the glyph floor (t^3): near-vertical at the top,
  // bending right with increasing slope toward the bottom. Boldness comes
  // from density, not luminance: peak stream color is only ~rgb(50,100,55).
  const arc = (t: number) => Math.pow(t, 3)

  const gx0 = 0.64 * w
  const bx0 = 0.72 * w
  const ribbons = [
    // green ribbon, right
    { x: gx0, d: 0.13 * w, cols: 13, t0: 0.0, c1: c.green, c2: c.greenSoft, a: 0.9 },
    // blue / violet ribbon, right beside it
    { x: bx0, d: 0.13 * w, cols: 13, t0: 0.0, c1: c.blue, c2: c.violet, a: 0.85 },
  ]

  // coherent gate per strip: lit/gap runs row by row, always lit up close
  const buildGate = (t0: number) => {
    const gates: number[] = []
    let i = 0
    while (i < rows.length) {
      const t = rows[i].t
      if (t < t0) {
        gates[i++] = 0
        continue
      }
      const local = (t - t0) / (1 - t0)
      if (local > 0.55) {
        gates[i++] = 1
        continue
      }
      const lit = rand() < 0.6 + 0.4 * local
      const run = 1 + Math.floor(rand() * 2)
      for (let k = 0; k < run && i < rows.length; k++) gates[i++] = lit ? 1 : 0
    }
    return gates
  }

  // Continuous dotted ribbons below the half-way point; chopped into
  // row-aligned blocks (gates) as they recede toward the top.
  const dots: StreamDot[] = []
  const colP = 5.5
  ribbons.forEach((s, si) => {
    const gates = buildGate(s.t0)
    rows.forEach((row, ri) => {
      if (row.t < s.t0) return
      const local = (row.t - s.t0) / (1 - s.t0)
      const solid = local > 0.5
      if (!solid && !gates[ri]) return
      const nCols = Math.max(4, Math.round(s.cols * (0.7 + 0.3 * row.t)))
      const yEnd = Math.min(row.y + row.rh, h)
      for (let yy = Math.round(row.y / 2) * 2; yy < yEnd; yy += 2) {
        const t = yy / h
        if ((yy / 2) % 6 === 5) continue // 1px notch every ~11px, keeps it dotted
        const x0 = s.x + s.d * arc(t)
        const fade = 0.55 + 0.45 * Math.pow(local, 1.2)
        for (let ci = 0; ci < nCols; ci++) {
          const lateral = ci === 0 || ci === nCols - 1 ? 0.55 : 1
          if (rand() > 0.94) continue
          const tint = rand() < 0.25 ? s.c2 : s.c1
          const base = Math.min(
            s.a * fade * lateral * (0.7 + 0.3 * rand()) * c.streamAlpha,
            0.95,
          )
          dots.push({
            x: x0 + ci * colP,
            y: yy,
            t,
            pre: `rgba(${tint[0]},${tint[1]},${tint[2]},`,
            base,
            phase: si * 1.7,
            size: 2,
          })
        }
      }
    })
  })

  // ---- instrument blips -------------------------------------------------------
  const blips: Blip[] = []
  const blipTints = [c.green, c.blue, c.glyphWarm, c.greenSoft]
  for (let i = 0; i < 10; i++) {
    const row = rows[2 + Math.floor(rand() * (rows.length - 3))]
    const tint = blipTints[Math.floor(rand() * blipTints.length)]
    const mask: number[] = []
    for (let k = 0; k < 15; k++) if (rand() < 0.55) mask.push(k)
    blips.push({
      x: Math.floor(rand() * (w / cellW)) * cellW + 14,
      y: row.y,
      pitch: 2.8 * row.scale,
      dot: 1.5 + 0.6 * row.t,
      pre: `rgba(${tint[0]},${tint[1]},${tint[2]},`,
      period: 4 + rand() * 6,
      offset: rand() * 10,
      mask,
    })
  }

  return { layer, dots, blips }
}

export default function HeroLabBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let scene: Scene | null = null
    let raf = 0
    let last = 0
    let visible = true
    let w = 0
    let h = 0
    let dpr = 1

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const frame = (now: number) => {
      raf = 0
      if (!scene) return
      if (now - last < 33) {
        raf = requestAnimationFrame(frame)
        return
      }
      last = now
      const T = now / 1000

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(scene.layer, 0, 0, w, h)

      for (const d of scene.dots) {
        // slow wave travelling down the stream
        const gain = 0.82 + 0.18 * Math.sin(T * 1.6 - d.t * 9 + d.phase)
        ctx.fillStyle = d.pre + (d.base * gain).toFixed(3) + ')'
        ctx.fillRect(d.x, d.y, d.size, d.size)
      }

      for (const b of scene.blips) {
        const p = ((T + b.offset) % b.period) / b.period
        const a = p < 0.18 ? Math.sin((p / 0.18) * Math.PI) * 0.5 : 0
        if (a <= 0.01) continue
        ctx.fillStyle = b.pre + a.toFixed(3) + ')'
        for (const k of b.mask) {
          ctx.fillRect(b.x + (k % 3) * b.pitch, b.y + Math.floor(k / 3) * b.pitch, b.dot, b.dot)
        }
      }

      if (visible && !reduced.matches) raf = requestAnimationFrame(frame)
    }

    const renderStatic = () => {
      if (!scene) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(scene.layer, 0, 0, w, h)
      for (const d of scene.dots) {
        ctx.fillStyle = d.pre + d.base.toFixed(3) + ')'
        ctx.fillRect(d.x, d.y, d.size, d.size)
      }
    }

    const start = () => {
      if (reduced.matches) {
        renderStatic()
      } else if (visible && !raf) {
        raf = requestAnimationFrame(frame)
      }
    }

    const rebuild = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      if (w === 0 || h === 0) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      scene = buildScene(w, h, dpr, document.documentElement.classList.contains('dark'))
      start()
    }

    rebuild()

    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)

    const mo = new MutationObserver(rebuild)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true
      if (visible) start()
    })
    io.observe(canvas)

    const onVis = () => {
      visible = document.visibilityState === 'visible'
      if (visible) start()
    }
    document.addEventListener('visibilitychange', onVis)
    reduced.addEventListener?.('change', start)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      reduced.removeEventListener?.('change', start)
    }
  }, [])

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      <canvas ref={ref} className="h-full w-full" />
      {/* blend under the fixed header */}
      <div className="absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-white to-transparent dark:from-[#110f0f]" />
      {/* readability scrim behind the bottom-left copy */}
      <div className="absolute bottom-0 left-0 h-[60%] w-[58%] bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.92),transparent_72%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(17,15,15,0.88),transparent_72%)]" />
    </div>
  )
}
