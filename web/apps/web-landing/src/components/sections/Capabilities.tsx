'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--capabilities-border)'

// ─────────────────────────────────────────────────────────────
// CARD 01 · Run · architecture diagram (grouped bounding boxes)
// Cloudflare-style: dashed labeled groups, curved arcs, return rays.
// ─────────────────────────────────────────────────────────────
function RunVisual() {
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 220" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="run-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 2 L 6 4 L 0 6 z" fill="currentColor" fillOpacity="0.6" />
          </marker>
          <pattern id="run-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.3" />
          </pattern>
        </defs>

        {/* faint engineering grid */}
        <rect x="6" y="14" width="348" height="170" fill="url(#run-grid)" />

        {/* ── Group A: AGENT — stacked candidates, one chosen ── */}
        <g>
          <text x="46" y="32" textAnchor="middle" fontSize="7"
                fill="currentColor" fillOpacity="0.6"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>AGENT</text>
          <rect x="10" y="38" width="74" height="86" fill="none"
                stroke="currentColor" strokeOpacity="0.32"
                strokeWidth="0.6" strokeDasharray="3 3" rx="3" />

          {/* 3 candidate cards — top one selected */}
          <g fill="none">
            {/* selected card */}
            <rect x="18" y="46" width="58" height="14" rx="1.2"
                  stroke="currentColor" strokeOpacity="0.85" strokeWidth="0.7" />
            <rect x="18" y="46" width="3" height="14"
                  fill="darkorange" fillOpacity="0.85" stroke="none" />
            <text x="26" y="55.5" fontSize="6.2" fill="currentColor" fillOpacity="0.9" style={{ fontFamily: MONO }}>
              read_file
            </text>
            <text x="72" y="55.5" textAnchor="end" fontSize="5" fill="darkorange" fillOpacity="0.9"
                  style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>SEL</text>

            {/* candidate 2 — dimmed */}
            <rect x="18" y="62" width="58" height="11" rx="1.2"
                  stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x="26" y="69.5" fontSize="6" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO }}>
              http_call
            </text>

            {/* candidate 3 — dimmed */}
            <rect x="18" y="75" width="58" height="11" rx="1.2"
                  stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x="26" y="82.5" fontSize="6" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO }}>
              db_write
            </text>

            {/* commit arrow */}
            <line x1="46" y1="90" x2="46" y2="100"
                  stroke="darkorange" strokeOpacity="0.85" strokeWidth="0.7" />
            <path d="M 43 97 L 46 101 L 49 97" stroke="darkorange" strokeOpacity="0.85"
                  strokeWidth="0.7" fill="none" />
          </g>
        </g>

        {/* AGENT → request callout */}
        <path id="run-path-1" d="M 84 82 Q 92 82 100 82"
              fill="none" stroke="currentColor" strokeOpacity="0.45"
              strokeWidth="0.5" strokeDasharray="2 2" markerEnd="url(#run-arrow)" />
        <circle r="1.2" fill="darkorange" fillOpacity="0.9">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M 84 82 Q 92 82 100 82" />
        </circle>

        {/* ── Request callout — API spec card with method chip ── */}
        <g>
          <rect x="100" y="56" width="72" height="54" rx="2"
                fill="none" stroke="darkorange" strokeOpacity="0.75"
                strokeWidth="0.6" strokeDasharray="3 2" />
          {/* dog-eared tab */}
          <path d="M 164 56 L 172 56 L 172 64 Z" fill="darkorange" fillOpacity="0.14" stroke="none" />

          {/* HTTP method chip */}
          <rect x="105" y="62" width="16" height="8" rx="1.2"
                fill="darkorange" fillOpacity="0.85" stroke="none" />
          <text x="113" y="68.2" textAnchor="middle" fontSize="5"
                fill="white" style={{ fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 600 }}>POST</text>
          <text x="124" y="68.5" fontSize="6.5" fill="darkorange" fillOpacity="0.95"
                style={{ fontFamily: MONO, letterSpacing: '0.02em' }}>/v1/tasks</text>

          <line x1="105" y1="74" x2="167" y2="74" stroke="darkorange" strokeOpacity="0.3" strokeWidth="0.4" />

          {/* body keys with colon-aligned values */}
          <text x="105" y="84" fontSize="5.8" fill="darkorange" fillOpacity="0.6" style={{ fontFamily: MONO }}>action</text>
          <text x="167" y="84" textAnchor="end" fontSize="5.8" fill="darkorange" fillOpacity="0.9" style={{ fontFamily: MONO }}>read_file</text>
          <text x="105" y="93" fontSize="5.8" fill="darkorange" fillOpacity="0.6" style={{ fontFamily: MONO }}>scope</text>
          <text x="167" y="93" textAnchor="end" fontSize="5.8" fill="darkorange" fillOpacity="0.9" style={{ fontFamily: MONO }}>bounded</text>
          <text x="105" y="102" fontSize="5.8" fill="darkorange" fillOpacity="0.6" style={{ fontFamily: MONO }}>sig</text>
          <text x="167" y="102" textAnchor="end" fontSize="5.8" fill="darkorange" fillOpacity="0.9" style={{ fontFamily: MONO }}>ed25519</text>
        </g>

        {/* → DISPATCH */}
        <path d="M 172 82 Q 188 82 200 82"
              fill="none" stroke="currentColor" strokeOpacity="0.45"
              strokeWidth="0.5" strokeDasharray="2 2" markerEnd="url(#run-arrow)" />
        <circle r="1.2" fill="darkorange" fillOpacity="0.9">
          <animateMotion dur="2.6s" begin="0.5s" repeatCount="indefinite" path="M 172 82 Q 188 82 200 82" />
        </circle>

        {/* ── Group B: DISPATCH — policy gate + tools ──────── */}
        <g>
          <text x="239" y="32" textAnchor="middle" fontSize="7"
                fill="currentColor" fillOpacity="0.6"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>DISPATCH</text>
          <rect x="200" y="38" width="78" height="86" fill="none"
                stroke="currentColor" strokeOpacity="0.32"
                strokeWidth="0.6" strokeDasharray="3 3" rx="3" />

          {/* policy gate header */}
          <g fill="none">
            <rect x="208" y="46" width="62" height="10" rx="1.2"
                  stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.5" />
            <path d="M 213 51 l 2 2 4 -4" stroke="currentColor" strokeOpacity="0.85" strokeWidth="0.7" />
            <text x="223" y="53.6" fontSize="5.5" fill="currentColor" fillOpacity="0.65"
                  style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>POLICY&nbsp;OK</text>
          </g>

          {/* three controlled tools — labeled */}
          <g stroke="currentColor" strokeOpacity="0.65" strokeWidth="0.6" fill="none">
            {[60, 76, 92].map((y, idx) => (
              <g key={y}>
                <rect x="208" y={y} width="62" height="12" rx="1.2" />
                <path d={`M 213 ${y + 6} l 2 2 4 -4`} strokeWidth="0.7" />
                <text x="223" y={y + 8} fontSize="6" fill="currentColor" fillOpacity="0.7" style={{ fontFamily: MONO }}>
                  tool · 0{idx + 1}
                </text>
                <text x="266" y={y + 8} textAnchor="end" fontSize="5.5" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
                  OK
                </text>
              </g>
            ))}
          </g>
        </g>

        {/* DISPATCH → RECEIPTS */}
        <path d="M 278 82 Q 283 82 288 82"
              fill="none" stroke="currentColor" strokeOpacity="0.45"
              strokeWidth="0.5" strokeDasharray="2 2" markerEnd="url(#run-arrow)" />
        <circle r="1.2" className="fill-emerald-700 dark:fill-emerald-400">
          <animateMotion dur="2.6s" begin="1s" repeatCount="indefinite" path="M 278 82 Q 283 82 288 82" />
        </circle>

        {/* ── Group C: RECEIPTS — perforated + sealed ─────── */}
        <g>
          <text x="322" y="32" textAnchor="middle" fontSize="7"
                className="fill-emerald-700 dark:fill-emerald-400" fillOpacity="0.75"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>RECEIPTS</text>
          <rect x="288" y="38" width="68" height="86" rx="3" fill="none"
                className="stroke-emerald-700 dark:stroke-emerald-400"
                strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray="3 3" />

          <g className="stroke-emerald-700 dark:stroke-emerald-400" fill="none" strokeWidth="0.6">
            {[48, 68, 88].map((y, idx) => (
              <g key={y}>
                <rect x="296" y={y} width="52" height="14" rx="1.2" />
                {/* perforation gaps */}
                <line x1="296" y1={y + 7} x2="299" y2={y + 7} strokeOpacity="0.55" />
                <line x1="345" y1={y + 7} x2="348" y2={y + 7} strokeOpacity="0.55" />
                {/* receipt id */}
                <text x="300" y={y + 5.5} fontSize="4.5"
                      className="fill-emerald-700 dark:fill-emerald-400"
                      fillOpacity="0.85"
                      style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
                  r₀{idx + 1}
                </text>
                {/* signature wave */}
                <path d={`M 309 ${y + 5.5} q 1.5 -2 3 0 t 3 0 t 3 0 t 3 0`}
                      strokeWidth="0.5" strokeOpacity="0.7" />
                {/* hash glyph row */}
                <g strokeWidth="0.45" strokeOpacity="0.55">
                  <line x1="300" y1={y + 10} x2="302" y2={y + 10} />
                  <line x1="303" y1={y + 10} x2="307" y2={y + 10} />
                  <line x1="308" y1={y + 10} x2="311" y2={y + 10} />
                  <line x1="312" y1={y + 10} x2="318" y2={y + 10} />
                </g>
                {/* wax seal */}
                <circle cx="340" cy={y + 7} r="2.4" strokeWidth="0.5" strokeOpacity="0.85" />
                <circle cx="340" cy={y + 7} r="0.9"
                        className="fill-emerald-700 dark:fill-emerald-400" stroke="none" />
                {/* seal rays */}
                <line x1="340" y1={y + 4.2} x2="340" y2={y + 3.4} strokeWidth="0.4" strokeOpacity="0.7" />
                <line x1="340" y1={y + 9.8} x2="340" y2={y + 10.6} strokeWidth="0.4" strokeOpacity="0.7" />
              </g>
            ))}
          </g>
        </g>

        {/* ── Return arcs converging on CHAIN · VALID seal ── */}
        <path d="M 46 124 Q 46 156 180 166"
              fill="none" stroke="currentColor" strokeOpacity="0.32"
              strokeWidth="0.5" strokeDasharray="2 3" />
        <path d="M 239 124 Q 239 156 180 166"
              fill="none" stroke="currentColor" strokeOpacity="0.32"
              strokeWidth="0.5" strokeDasharray="2 3" />
        <path d="M 322 124 Q 322 156 180 166"
              fill="none" className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="2 3" />

        {/* chain valid seal — official-looking circular stamp with tick marks */}
        <g>
          {/* outer ring */}
          <circle cx="180" cy="168" r="6.5" fill="none"
                  className="stroke-emerald-700 dark:stroke-emerald-400"
                  strokeWidth="0.55" strokeOpacity="0.55" />
          <circle cx="180" cy="168" r="5.2" fill="none"
                  className="stroke-emerald-700 dark:stroke-emerald-400"
                  strokeWidth="0.45" strokeOpacity="0.4" />
          {/* clock-position ticks */}
          <g className="stroke-emerald-700 dark:stroke-emerald-400" strokeWidth="0.5" strokeOpacity="0.7">
            <line x1="180" y1="161.5" x2="180" y2="163" />
            <line x1="180" y1="173" x2="180" y2="174.5" />
            <line x1="173.5" y1="168" x2="175" y2="168" />
            <line x1="185" y1="168" x2="186.5" y2="168" />
            <line x1="175.4" y1="163.4" x2="176.5" y2="164.5" strokeOpacity="0.45" />
            <line x1="183.5" y1="171.5" x2="184.6" y2="172.6" strokeOpacity="0.45" />
            <line x1="184.6" y1="163.4" x2="183.5" y2="164.5" strokeOpacity="0.45" />
            <line x1="176.5" y1="171.5" x2="175.4" y2="172.6" strokeOpacity="0.45" />
          </g>
          {/* inner checkmark */}
          <path d="M 177.2 168 l 1.6 1.6 3.2 -3.2" fill="none"
                className="stroke-emerald-700 dark:stroke-emerald-400"
                strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite" />
          </path>
        </g>
        <text x="180" y="186" textAnchor="middle" fontSize="6.5"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          CHAIN&nbsp;·&nbsp;VALID
        </text>

      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 02 · Recover · handoff (thin-lines schematic)
// ─────────────────────────────────────────────────────────────
function RecoverVisual() {
  // 5 steps; runtime A owns 01–03, runtime B picks up 04–05.
  const steps = [
    { name: 'read_file', n: '01', host: 'A', ms: '12ms' },
    { name: 'http_call', n: '02', host: 'A', ms: '34ms' },
    { name: 'db_write',  n: '03', host: 'A', ms: '47ms' },
    { name: 'receipt',   n: '04', host: 'B', ms: '52ms' },
    { name: 'verify',    n: '05', host: 'B', ms: '58ms' },
  ]
  const X0 = 34, X1 = 326, Y = 108
  const tickX = (i: number) => X0 + ((X1 - X0) / (steps.length - 1)) * i
  // Halfway between step 03 and 04 → handoff break
  const breakX = (tickX(2) + tickX(3)) / 2

  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 200" className="w-full" preserveAspectRatio="xMidYMid meet">

        {/* ── Host environment bands ─────────────────────── */}
        <rect x={X0 - 4} y={Y - 26} width={tickX(2) + 12 - (X0 - 4)} height={48}
              fill="currentColor" fillOpacity="0.025" stroke="none" />
        <rect x={tickX(3) - 12} y={Y - 26} width={X1 + 4 - (tickX(3) - 12)} height={48}
              className="fill-emerald-700 dark:fill-emerald-400"
              fillOpacity="0.05" stroke="none" />

        {/* Host A icon — stacked planes (faulted) */}
        <g transform={`translate(${X0 - 22} ${Y - 8})`}>
          <g stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.5" fill="none">
            <path d="M 0 4 L 7 0 L 14 4 L 7 8 Z" />
            <path d="M 0 8 L 7 4 L 14 8 L 7 12 Z" />
            <path d="M 0 12 L 7 8 L 14 12 L 7 16 Z" />
          </g>
          {/* faulted cross */}
          <g stroke="darkorange" strokeOpacity="0.9" strokeWidth="0.7" strokeLinecap="round">
            <line x1="3.5" y1="6" x2="10.5" y2="13" />
            <line x1="10.5" y1="6" x2="3.5" y2="13" />
          </g>
        </g>

        {/* Host B icon — stacked planes (live) */}
        <g transform={`translate(${X1 + 8} ${Y - 8})`}>
          <g className="stroke-emerald-700 dark:stroke-emerald-400"
             strokeOpacity="0.8" strokeWidth="0.5" fill="none">
            <path d="M 0 4 L 7 0 L 14 4 L 7 8 Z" />
            <path d="M 0 8 L 7 4 L 14 8 L 7 12 Z" />
            <path d="M 0 12 L 7 8 L 14 12 L 7 16 Z" />
          </g>
          {/* LED dot */}
          <circle cx="14" cy="0" r="1.4"
                  className="fill-emerald-700 dark:fill-emerald-400">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Runtime span underlines */}
        <line x1={X0} y1={Y - 30} x2={tickX(2) + 6} y2={Y - 30}
              stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.5" />
        <text x={(X0 + tickX(2)) / 2} y={Y - 34} textAnchor="middle" fontSize="6.5"
              fill="currentColor" fillOpacity="0.5"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          RUNTIME&nbsp;A
        </text>
        <line x1={tickX(3) - 6} y1={Y - 30} x2={X1} y2={Y - 30}
              className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.6" strokeWidth="0.5" />
        <text x={(tickX(3) + X1) / 2} y={Y - 34} textAnchor="middle" fontSize="6.5"
              className="fill-emerald-700 dark:fill-emerald-400"
              fillOpacity="0.75"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          RUNTIME&nbsp;B
        </text>

        {/* Primary axis with break at the handoff */}
        <line x1={X0} y1={Y} x2={breakX - 6} y2={Y}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        <line x1={breakX + 6} y1={Y} x2={X1} y2={Y}
              className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.6" strokeWidth="0.5" />
        {/* break: dramatic lightning glyph with surrounding flash */}
        <circle cx={breakX} cy={Y} r="9" fill="darkorange" fillOpacity="0.08" stroke="none">
          <animate attributeName="r" values="9;11;9" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <path d={`M ${breakX - 4} ${Y - 7} L ${breakX} ${Y - 1} L ${breakX - 2.5} ${Y - 1} L ${breakX + 2} ${Y + 7} L ${breakX - 1.5} ${Y + 1} L ${breakX + 2} ${Y + 1} Z`}
              fill="darkorange" fillOpacity="0.85" stroke="darkorange" strokeOpacity="1" strokeWidth="0.5"
              strokeLinejoin="round" />
        {/* End caps */}
        <line x1={X0} y1={Y - 4} x2={X0} y2={Y + 4} stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        <line x1={X1} y1={Y - 4} x2={X1} y2={Y + 4}
              className="stroke-emerald-700 dark:stroke-emerald-400" strokeOpacity="0.6" strokeWidth="0.5" />

        {/* ── HANDOFF callout from break ──────────────────── */}
        <line x1={breakX} y1={Y + 8} x2={breakX} y2={Y + 26}
              stroke="darkorange" strokeOpacity="0.55" strokeWidth="0.5" strokeDasharray="2 3" />
        <text x={breakX} y={Y + 38} textAnchor="middle" fontSize="6.5"
              fill="darkorange" fillOpacity="0.85"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          HOST&nbsp;FAULT
        </text>

        {/* checkpoint-carry arc above axis from last A step to first B step */}
        <path d={`M ${tickX(2)} ${Y - 22} Q ${breakX} ${Y - 44} ${tickX(3)} ${Y - 22}`}
              fill="none" className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.55" strokeWidth="0.5" strokeDasharray="2 2" />
        {/* checkpoint envelope traveling along the carry arc */}
        <g>
          <g>
            <rect x="-3.5" y="-2.4" width="7" height="4.8" rx="0.6"
                  className="fill-emerald-700 dark:fill-emerald-400"
                  fillOpacity="0.95" stroke="none" />
            <path d="M -3.5 -2.4 L 0 0.4 L 3.5 -2.4" fill="none"
                  stroke="white" strokeOpacity="0.85" strokeWidth="0.5" />
          </g>
          <animateMotion dur="2.8s" repeatCount="indefinite"
                         path={`M ${tickX(2)} ${Y - 22} Q ${breakX} ${Y - 44} ${tickX(3)} ${Y - 22}`} />
        </g>

        {/* ── Steps ──────────────────────────────────────── */}
        {steps.map((s, i) => {
          const x = tickX(i)
          const isB = s.host === 'B'
          const isFinal = i === steps.length - 1
          return (
            <g key={s.n}>
              <line x1={x} y1={Y - 5} x2={x} y2={Y + 5}
                    stroke={isB ? undefined : 'currentColor'}
                    className={isB ? 'stroke-emerald-700 dark:stroke-emerald-400' : ''}
                    strokeOpacity={isFinal ? 0.9 : isB ? 0.75 : 0.5} strokeWidth="0.5" />
              <text x={x} y={Y - 14} textAnchor="middle" fontSize="8"
                    fill="currentColor" fillOpacity={isB ? 0.92 : 0.78}
                    style={{ fontFamily: MONO }}>
                {s.name}
              </text>

              {/* committed mark + tiny receipt stub */}
              {isFinal ? (
                <>
                  <circle cx={x} cy={Y + 18} r="3.4" fill="none"
                          className="stroke-emerald-700 dark:stroke-emerald-400"
                          strokeWidth="0.7" />
                  <circle cx={x} cy={Y + 18} r="1.2"
                          className="fill-emerald-700 dark:fill-emerald-400">
                    <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                </>
              ) : (
                <>
                  <circle cx={x} cy={Y + 18} r="1.5"
                          className="fill-emerald-700 dark:fill-emerald-400" />
                  {/* receipt stub */}
                  <rect x={x - 5} y={Y + 26} width="10" height="6" rx="0.8"
                        fill="none"
                        className="stroke-emerald-700 dark:stroke-emerald-400"
                        strokeOpacity="0.55" strokeWidth="0.45" />
                  <line x1={x - 3} y1={Y + 29} x2={x + 3} y2={Y + 29}
                        className="stroke-emerald-700 dark:stroke-emerald-400"
                        strokeOpacity="0.4" strokeWidth="0.4" />
                </>
              )}
              <text x={x} y={Y + 52} textAnchor="middle" fontSize="6"
                    fill="currentColor" fillOpacity="0.45"
                    style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
                {s.n}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 03 · Verify · receipt chain (thin-lines schematic)
// ─────────────────────────────────────────────────────────────
function ReceiptVisual() {
  // Vertical chain of receipts — one per committed action.
  // Customer-facing only: no hash labels, no digests, no key vocabulary.
  const receipts = [
    { action: 'read approved file',   state: 'signed' },
    { action: 'call approved API',    state: 'signed' },
    { action: 'write approved record', state: 'signed' },
    { action: 'receipt issued',       state: 'signed' },
    { action: 'verify chain',         state: 'valid'  },
  ]
  const SPINE_X = 84
  const Y0 = 46
  const STEP = 24
  const ringY = (i: number) => Y0 + i * STEP
  const lastY = ringY(receipts.length - 1)

  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 200" className="w-full" preserveAspectRatio="xMidYMid meet">

        {/* ── Vertical spine ─────────────────────────────── */}
        <line x1={SPINE_X} y1={Y0 - 8} x2={SPINE_X} y2={lastY + 8}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        <line x1={SPINE_X - 4} y1={Y0 - 8} x2={SPINE_X + 4} y2={Y0 - 8}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />

        {/* interlocking chain-link glyphs between consecutive receipts */}
        {receipts.map((_, i) => {
          if (i === 0) return null
          const mid = (ringY(i - 1) + ringY(i)) / 2
          return (
            <g key={`link-${i}`} transform={`translate(${SPINE_X - 14} ${mid})`}>
              <rect x="-4" y="-4.6" width="8" height="5.4" rx="2.2" fill="none"
                    className="stroke-emerald-700 dark:stroke-emerald-400"
                    strokeOpacity="0.55" strokeWidth="0.55" />
              <rect x="-4" y="-0.8" width="8" height="5.4" rx="2.2" fill="none"
                    className="stroke-emerald-700 dark:stroke-emerald-400"
                    strokeOpacity="0.55" strokeWidth="0.55" />
            </g>
          )
        })}

        {/* ── Receipts ──────────────────────────────────── */}
        {receipts.map((r, i) => {
          const y = ringY(i)
          const isFinal = i === receipts.length - 1
          const idLabel = isFinal ? 'r₀₅' : `r₀${i + 1}`
          return (
            <g key={r.action}>
              {/* id badge on spine left */}
              <text x={SPINE_X - 24} y={y + 2.4} fontSize="6.5"
                    fill="currentColor" fillOpacity="0.55"
                    style={{ fontFamily: MONO, letterSpacing: '0.06em' }}>
                {idLabel}
              </text>

              {/* ring on spine */}
              <circle cx={SPINE_X} cy={y} r={isFinal ? 3.8 : 3}
                      className={isFinal
                        ? 'fill-white dark:fill-dark-bg stroke-emerald-700 dark:stroke-emerald-400'
                        : 'fill-white dark:fill-dark-bg stroke-emerald-700 dark:stroke-emerald-400'}
                      strokeOpacity={isFinal ? undefined : 0.7}
                      strokeWidth={isFinal ? 0.85 : 0.6} />
              {isFinal && (
                <circle cx={SPINE_X} cy={y} r="1.2"
                        className="fill-emerald-700 dark:fill-emerald-400">
                  <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* branch hairline */}
              <line x1={SPINE_X + (isFinal ? 5 : 4)} y1={y} x2={SPINE_X + 22} y2={y}
                    stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.5" />

              {/* signature wave glyph */}
              <path d={`M ${SPINE_X + 24} ${y} q 1.6 -2.4 3.2 0 t 3.2 0 t 3.2 0`}
                    fill="none"
                    className="stroke-emerald-700 dark:stroke-emerald-400"
                    strokeOpacity="0.75" strokeWidth="0.55" strokeLinecap="round" />

              {/* action label */}
              <text x={SPINE_X + 36} y={y + 2.5} fontSize="8"
                    fill="currentColor" fillOpacity={isFinal ? 0.92 : 0.82}
                    style={{ fontFamily: MONO }}>
                {r.action}
              </text>

              {/* state */}
              <text x="326" y={y + 2.5} textAnchor="end" fontSize="7"
                    className={r.state === 'valid' ? 'fill-emerald-700 dark:fill-emerald-400' : ''}
                    fill={r.state === 'valid' ? undefined : 'currentColor'}
                    fillOpacity={r.state === 'valid' ? undefined : 0.6}
                    style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                {r.state}
              </text>
            </g>
          )
        })}

        {/* verifier — magnifying glass scanning the chain */}
        <g transform={`translate(322 ${ringY(0) - 18})`}>
          <circle cx="0" cy="0" r="4" fill="none"
                  stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.7" />
          <line x1="2.8" y1="2.8" x2="6" y2="6"
                stroke="currentColor" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
          <text x="0" y="-7" textAnchor="middle" fontSize="5"
                fill="currentColor" fillOpacity="0.5"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>VERIFIER</text>
        </g>
        <path d={`M 316 ${ringY(0) - 12} Q 280 ${(Y0 + lastY) / 2} ${SPINE_X + 6} ${lastY}`}
              fill="none" stroke="currentColor" strokeOpacity="0.22"
              strokeWidth="0.4" strokeDasharray="1.5 2.5" />
        <circle r="1" fill="currentColor" fillOpacity="0.7">
          <animateMotion dur="3.4s" repeatCount="indefinite"
                         path={`M 316 ${ringY(0) - 12} Q 280 ${(Y0 + lastY) / 2} ${SPINE_X + 6} ${lastY}`} />
        </circle>

        {/* end-of-chain tag */}
        <line x1={SPINE_X} y1={lastY + 8} x2={SPINE_X} y2={lastY + 16}
              className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.55" strokeWidth="0.5" strokeDasharray="2 3" />
        <text x={SPINE_X} y={lastY + 26} textAnchor="middle" fontSize="6.5"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          CHAIN&nbsp;·&nbsp;VALID
        </text>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 04 · Inspect · operator manifest row (thin-lines)
// ─────────────────────────────────────────────────────────────
function InspectVisual() {
  // Pure typographic manifest. No axes, no ticks — just a record sheet.
  const rows: { k: string; v: string; accent?: boolean }[] = [
    { k: 'TASK',        v: 'task_019de343' },
    { k: 'STATUS',      v: 'completed',          accent: true },
    { k: 'RUNTIME',     v: 'fra1-a → fra1-b' },
    { k: 'ACTIONS',     v: '5 of 5' },
    { k: 'RECEIPT',     v: 'r₀₅ · ed25519',       accent: true },
    { k: 'CHAIN',       v: 'valid',               accent: true },
    { k: 'DURATION',    v: '185 ms' },
  ]

  const COL_K_X = 60
  const COL_V_X = 168

  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 200" className="w-full" preserveAspectRatio="xMidYMid meet">

        {/* live LED dot */}
        <circle cx="38" cy="32" r="1.6"
                className="fill-emerald-700 dark:fill-emerald-400">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <text x="44" y="34" fontSize="6" fill="currentColor" fillOpacity="0.6"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>LIVE</text>
        <text x="326" y="34" textAnchor="end" fontSize="6" fill="currentColor" fillOpacity="0.45"
              style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          task_019de343
        </text>
        <line x1="34" y1="44" x2="326" y2="44"
              stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.5" />

        {/* ── Rows ─────────────────────────────────────────── */}
        {rows.map((r, i) => {
          const y = 62 + i * 17
          return (
            <g key={r.k}>
              {/* row accent pill */}
              {r.accent && (
                <rect x="34" y={y - 9} width="292" height="13"
                      className="fill-emerald-700 dark:fill-emerald-400"
                      fillOpacity="0.06" stroke="none" />
              )}
              <text x={COL_K_X} y={y} fontSize="7.5"
                    fill="currentColor" fillOpacity="0.55"
                    style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                {r.k}
              </text>
              <text x={COL_V_X} y={y} fontSize="9"
                    fill={r.accent ? undefined : 'currentColor'}
                    fillOpacity={r.accent ? undefined : 0.9}
                    className={r.accent ? 'fill-emerald-700 dark:fill-emerald-400' : ''}
                    style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
                {r.v}
              </text>

              {/* right-side flag glyph */}
              {r.accent ? (
                <g transform={`translate(316 ${y - 4})`}>
                  <circle cx="0" cy="0" r="2.2" fill="none"
                          className="stroke-emerald-700 dark:stroke-emerald-400"
                          strokeOpacity="0.85" strokeWidth="0.5" />
                  <path d="M -1 0 l 1 1 2 -2" fill="none"
                        className="stroke-emerald-700 dark:stroke-emerald-400"
                        strokeOpacity="0.95" strokeWidth="0.6" />
                </g>
              ) : (
                <circle cx="316" cy={y - 4} r="0.9"
                        fill="currentColor" fillOpacity="0.35" />
              )}

              {i < rows.length - 1 && (
                <line x1="34" y1={y + 4} x2="326" y2={y + 4}
                      stroke="currentColor" strokeOpacity="0.1"
                      strokeWidth="0.5" strokeDasharray="1 3" />
              )}
            </g>
          )
        })}

        {/* closing rule */}
        <line x1="34" y1={62 + rows.length * 17 - 8} x2="326" y2={62 + rows.length * 17 - 8}
              stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.5" />
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Card layout
// ─────────────────────────────────────────────────────────────
type Card = {
  fig: string
  num: string
  name: string
  body: string
  sublist: { id: string; label: string }[]
  cta: { label: string; href: string }
  Visual: () => React.ReactElement
}

const cards: Card[] = [
  {
    fig: 'FIG.1 · THE TASK',
    num: '01',
    name: 'Run',
    body: 'Turn agent decisions into controlled actions. Igris runs each action through a bounded execution path and records exactly what committed.',
    sublist: [
      { id: '1.1', label: 'Real actions execute through controlled tools' },
      { id: '1.2', label: 'Each committed step becomes durable evidence' },
      { id: '1.3', label: 'Side effects are counted and attributable' },
    ],
    cta: { label: 'DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: RunVisual,
  },
  {
    fig: 'FIG.2 · RECOVERY HANDOFF',
    num: '02',
    name: 'Recover',
    body: 'When an execution environment stops mid-run, the task does not restart from zero. Igris continues from recorded progress.',
    sublist: [
      { id: '2.1', label: 'Resume from recorded progress' },
      { id: '2.2', label: 'Already-committed actions are not replayed' },
      { id: '2.3', label: 'Recovery behavior is proven before release' },
    ],
    cta: { label: 'DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: RecoverVisual,
  },
  {
    fig: 'FIG.3 · RECEIPT CHAIN',
    num: '03',
    name: 'Verify',
    body: 'Check the receipt chain. Every committed action leaves a signed receipt that can be checked later.',
    sublist: [
      { id: '3.1', label: 'Signed receipts for completed work' },
      { id: '3.2', label: 'Execution identity is bound to the proof' },
      { id: '3.3', label: 'Chain validity survives recovery boundaries' },
    ],
    cta: { label: 'DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: ReceiptVisual,
  },
  {
    fig: 'FIG.4 · OPERATOR RECORD',
    num: '04',
    name: 'Inspect',
    body: 'See the evidence without raw payloads. Operators see the outcome, recovery path, evidence trail, and verification state in one place.',
    sublist: [
      { id: '4.1', label: 'Plain status for agent actions' },
      { id: '4.2', label: 'Recovery handoff remains visible' },
      { id: '4.3', label: 'Evidence summaries stay safe to inspect' },
    ],
    cta: { label: 'OPEN THE CONSOLE', href: 'https://console.igrisinertial.com' },
    Visual: InspectVisual,
  },
]

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
export default function Capabilities() {
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setRevealed(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <style>{`
        @keyframes cap-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cap-card { opacity: 0; }
        .cap-card.is-in {
          animation: cap-card-in 540ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
      `}</style>

      <div className="px-0">
        <div className="px-0">

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-10 md:pt-14 pb-6 md:pb-8">
            <div
              className="pb-5 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              02&nbsp;·&nbsp;EXECUTION
            </div>
            <h2
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                maxWidth: '22ch',
              }}
            >
              Run agent actions you can recover and prove.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Igris turns agent decisions into controlled actions with
              recorded progress, clean-host recovery, signed receipts, and
              operator-readable evidence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <a
                href="https://docs.igrisinertial.com"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
                style={{ fontFamily: SANS }}
              >
                Read the docs ↗
              </a>
            </div>
          </div>

          

          {/* 2×2 card grid */}
          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ borderTop: borderStyle, borderLeft: borderStyle }}
          >
            {cards.map((c, i) => (
              <article
                key={c.num}
                className={`cap-card ${revealed ? 'is-in' : ''} relative flex flex-col`}
                style={{
                  borderRight: borderStyle,
                  borderBottom: borderStyle,
                  animationDelay: `${120 + i * 110}ms`,
                  height: 'clamp(580px, 60vw, 660px)',
                }}
              >
                {/* FIG.N tag · plain-language name + dominant status */}
                <div className="px-7 md:px-9 pt-6 pb-3 flex items-baseline justify-between gap-4">
                  <span
                    className="text-gray-400 dark:text-[#5a5a52] truncate"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    {c.fig}
                  </span>
                </div>

                {/* Visual area — fixed height so all four cards align */}
                <div
                  className="px-6 md:px-7 pt-6 pb-8 flex items-center justify-center text-gray-900 dark:text-[#c8c8b8]"
                  style={{ height: 'clamp(260px, 26vw, 320px)' }}
                >
                  <div className="w-full">
                    <c.Visual />
                  </div>
                </div>

                {/* Title + body + sublist row */}
                <div className="px-7 md:px-9 pt-6 pb-8 mt-auto flex-1 flex flex-col">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-x-8 gap-y-5 items-start">
                    <div>
                      <h3
                        className="text-[#000000] dark:text-[#f6f6f4]"
                        style={{
                          fontFamily: SANS,
                          fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
                          fontWeight: 500,
                          lineHeight: 1.15,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        <span className="text-gray-400 dark:text-[#5a5a52] mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {c.num}
                        </span>
                        {c.name}
                      </h3>
                      <p
                        className="mt-3 text-gray-700 dark:text-[#c8c8b8] max-w-[40ch]"
                        style={{ fontFamily: SANS, fontSize: '0.925rem', lineHeight: 1.55 }}
                      >
                        {c.body}
                      </p>
                      <a
                        href={c.cta.href}
                        className="mt-5 self-start inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12] normal-case"
                        style={{ fontFamily: SANS }}
                      >
                        {c.cta.label} ↗
                      </a>
                    </div>

                    <ol className="flex flex-col gap-y-2 min-w-[180px]">
                      {c.sublist.map((s) => (
                        <li
                          key={s.id}
                          className="grid items-baseline"
                          style={{ gridTemplateColumns: '28px 1fr', gap: '8px' }}
                        >
                          <span
                            className="text-gray-400 dark:text-[#5a5a52]"
                            style={{
                              fontFamily: MONO,
                              fontSize: '11px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {s.id}
                          </span>
                          <span
                            className="text-gray-700 dark:text-[#c8c8b8]"
                            style={{ fontFamily: SANS, fontSize: '0.85rem', lineHeight: 1.45 }}
                          >
                            {s.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="pb-6 md:pb-10" />

        </div>
      </div>
    </section>
  )
}
