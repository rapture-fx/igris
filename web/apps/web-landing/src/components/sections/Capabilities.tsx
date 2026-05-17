'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

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
        </defs>

        {/* ── Title row ──────────────────────────────────────────── */}
        <text x="14" y="14" fontSize="7" fill="currentColor" fillOpacity="0.55"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          CONTROLLED&nbsp;·&nbsp;TASK
        </text>
        <text x="346" y="14" textAnchor="end" fontSize="7"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          3&nbsp;ACTIONS&nbsp;·&nbsp;VERIFIED
        </text>

        {/* ── Group A: AGENT ────────────────────────────────────── */}
        <g>
          <text x="42" y="36" textAnchor="middle" fontSize="7"
                fill="currentColor" fillOpacity="0.6"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
            AGENT
          </text>
          <rect x="0" y="42" width="84" height="80" fill="none"
                stroke="currentColor" strokeOpacity="0.32"
                strokeWidth="0.6" strokeDasharray="3 3" rx="3" />
          {/* two agent tiles */}
          <g stroke="currentColor" strokeOpacity="0.65" strokeWidth="0.6" fill="none">
            <rect x="22" y="56" width="18" height="18" rx="1.5" />
            <circle cx="31" cy="62" r="2.3" />
            <path d="M 26 70 q 5 -4 10 0" strokeWidth="0.55" />
            <rect x="44" y="56" width="18" height="18" rx="1.5" />
            <circle cx="53" cy="62" r="2.3" />
            <path d="M 48 70 q 5 -4 10 0" strokeWidth="0.55" />
          </g>
          <text x="42" y="115" textAnchor="middle" fontSize="6"
                fill="currentColor" fillOpacity="0.5"
                style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
            decides &amp; submits
          </text>
        </g>

        {/* AGENT → request callout (curved) */}
        <path d="M 84 82 Q 92 82 100 82"
              fill="none" stroke="currentColor" strokeOpacity="0.45"
              strokeWidth="0.5" strokeDasharray="2 2" markerEnd="url(#run-arrow)" />

        {/* ── Request callout ───────────────────────────────────── */}
        <g>
          <rect x="100" y="58" width="72" height="50" rx="6"
                fill="none" stroke="darkorange" strokeOpacity="0.75"
                strokeWidth="0.6" strokeDasharray="3 2" />
          <text x="106" y="71" fontSize="7" fill="darkorange" fillOpacity="0.9"
                style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
            POST&nbsp;/tasks
          </text>
          <text x="106" y="83" fontSize="6.5" fill="darkorange" fillOpacity="0.7"
                style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
            read_file
          </text>
          <text x="106" y="93" fontSize="6.5" fill="darkorange" fillOpacity="0.7"
                style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
            http_call
          </text>
          <text x="106" y="103" fontSize="6.5" fill="darkorange" fillOpacity="0.7"
                style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
            db_write
          </text>
        </g>

        {/* request callout → DISPATCH (curved) */}
        <path d="M 172 82 Q 188 82 200 82"
              fill="none" stroke="currentColor" strokeOpacity="0.45"
              strokeWidth="0.5" strokeDasharray="2 2" markerEnd="url(#run-arrow)" />

        {/* ── Group B: DISPATCH ─────────────────────────────────── */}
        <g>
          <text x="239" y="36" textAnchor="middle" fontSize="7"
                fill="currentColor" fillOpacity="0.6"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
            DISPATCH
          </text>
          <rect x="200" y="42" width="78" height="80" fill="none"
                stroke="currentColor" strokeOpacity="0.32"
                strokeWidth="0.6" strokeDasharray="3 3" rx="3" />
          <g stroke="currentColor" strokeOpacity="0.65" strokeWidth="0.6" fill="none">
            <rect x="218" y="50" width="42" height="14" rx="1.5" />
            <path d="M 224 57 l 3 3 6 -6" strokeWidth="0.7" />
            <rect x="218" y="68" width="42" height="14" rx="1.5" />
            <path d="M 224 75 l 3 3 6 -6" strokeWidth="0.7" />
            <rect x="218" y="86" width="42" height="14" rx="1.5" />
            <path d="M 224 93 l 3 3 6 -6" strokeWidth="0.7" />
          </g>
          <text x="239" y="115" textAnchor="middle" fontSize="6"
                fill="currentColor" fillOpacity="0.5"
                style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
            3&nbsp;controlled&nbsp;tools
          </text>
        </g>

        {/* DISPATCH → RECEIPTS (curved) */}
        <path d="M 278 82 Q 283 82 288 82"
              fill="none" stroke="currentColor" strokeOpacity="0.45"
              strokeWidth="0.5" strokeDasharray="2 2" markerEnd="url(#run-arrow)" />

        {/* ── Group C: RECEIPTS (emerald) ───────────────────────── */}
        <g>
          <text x="323" y="36" textAnchor="middle" fontSize="7"
                className="fill-emerald-700 dark:fill-emerald-400"
                fillOpacity="0.75"
                style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
            RECEIPTS
          </text>
          <rect x="288" y="42" width="72" height="80" rx="3" fill="none"
                className="stroke-emerald-700 dark:stroke-emerald-400"
                strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray="3 3" />
          <g className="stroke-emerald-700 dark:stroke-emerald-400" fill="none" strokeWidth="0.6">
            <rect x="308" y="52" width="30" height="14" rx="1.5" />
            <line x1="312" y1="58" x2="324" y2="58" strokeOpacity="0.55" />
            <line x1="312" y1="62" x2="320" y2="62" strokeOpacity="0.45" />
            <rect x="308" y="70" width="30" height="14" rx="1.5" />
            <line x1="312" y1="76" x2="324" y2="76" strokeOpacity="0.55" />
            <line x1="312" y1="80" x2="320" y2="80" strokeOpacity="0.45" />
            <rect x="308" y="88" width="30" height="14" rx="1.5" />
            <line x1="312" y1="94" x2="324" y2="94" strokeOpacity="0.55" />
            <line x1="312" y1="98" x2="320" y2="98" strokeOpacity="0.45" />
          </g>
          <text x="323" y="115" textAnchor="middle" fontSize="6"
                className="fill-emerald-700 dark:fill-emerald-400"
                fillOpacity="0.65"
                style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
            one&nbsp;per&nbsp;commit
          </text>
        </g>

        {/* ── Return arcs converging on CHAIN · VALID capsule ───── */}
        <path d="M 42 122 Q 42 158 180 168"
              fill="none" stroke="currentColor" strokeOpacity="0.32"
              strokeWidth="0.5" strokeDasharray="2 3" />
        <path d="M 239 122 Q 239 158 180 168"
              fill="none" stroke="currentColor" strokeOpacity="0.32"
              strokeWidth="0.5" strokeDasharray="2 3" />
        <path d="M 323 122 Q 323 158 180 168"
              fill="none" className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="2 3" />

        {/* verify tag — matches FIG.3 receipt-chain end-of-chain style */}
        <line x1="180" y1="168" x2="180" y2="176"
              className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.55" strokeWidth="0.5" strokeDasharray="2 3" />
        <text x="180" y="186" textAnchor="middle" fontSize="6.5"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          CHAIN&nbsp;·&nbsp;VALID
        </text>

        {/* ── Footer annotations ─────────────────────────────────── */}
        <text x="14" y="206" fontSize="6.5" fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
          one&nbsp;agent&nbsp;·&nbsp;controlled&nbsp;tools
        </text>
        <text x="346" y="206" textAnchor="end" fontSize="6.5"
              fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em', fontStyle: 'italic' }}>
          every commit becomes evidence
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
    { name: 'read_file', n: '01', host: 'A' },
    { name: 'http_call', n: '02', host: 'A' },
    { name: 'db_write',  n: '03', host: 'A' },
    { name: 'receipt',   n: '04', host: 'B' },
    { name: 'verify',    n: '05', host: 'B' },
  ]
  const X0 = 34, X1 = 326, Y = 108
  const tickX = (i: number) => X0 + ((X1 - X0) / (steps.length - 1)) * i
  // Halfway between step 03 and 04 → handoff break
  const breakX = (tickX(2) + tickX(3)) / 2

  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 200" className="w-full" preserveAspectRatio="xMidYMid meet">

        {/* ── Title row ──────────────────────────────────────────── */}
        <text x={X0} y="20" fontSize="7" fill="currentColor" fillOpacity="0.55"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          RECOVERY&nbsp;·&nbsp;CLEAN&nbsp;HOST
        </text>
        <text x={X1} y="20" textAnchor="end" fontSize="7"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          RESUMED&nbsp;·&nbsp;NO&nbsp;REPLAY
        </text>

        {/* ── Dimension bracket ──────────────────────────────────── */}
        <g stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.5" fill="none" shapeRendering="crispEdges">
          <line x1={X0} y1="48" x2={X1} y2="48" />
          <line x1={X0} y1="44" x2={X0} y2="52" />
          <line x1={X1} y1="44" x2={X1} y2="52" />
        </g>
        <text x={(X0 + X1) / 2} y="40" textAnchor="middle" fontSize="6.5"
              fill="currentColor" fillOpacity="0.5"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          5&nbsp;STEPS&nbsp;·&nbsp;1&nbsp;HANDOFF&nbsp;·&nbsp;0&nbsp;DUPLICATES
        </text>

        {/* ── Runtime spans (thin underlines above the axis) ─────── */}
        <line x1={X0} y1={Y - 30} x2={tickX(2) + 6} y2={Y - 30}
              stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.5" />
        <text x={(X0 + tickX(2)) / 2} y={Y - 34} textAnchor="middle" fontSize="6.5"
              fill="currentColor" fillOpacity="0.45"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          RUNTIME&nbsp;A
        </text>
        <line x1={tickX(3) - 6} y1={Y - 30} x2={X1} y2={Y - 30}
              className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.55" strokeWidth="0.5" />
        <text x={(tickX(3) + X1) / 2} y={Y - 34} textAnchor="middle" fontSize="6.5"
              className="fill-emerald-700 dark:fill-emerald-400"
              fillOpacity="0.7"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          RUNTIME&nbsp;B
        </text>

        {/* ── Primary axis with a break at the handoff ───────────── */}
        <line x1={X0} y1={Y} x2={breakX - 6} y2={Y}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        <line x1={breakX + 6} y1={Y} x2={X1} y2={Y}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        {/* Two diagonal hash marks — drafting "break" symbol */}
        <line x1={breakX - 5} y1={Y - 4} x2={breakX - 1} y2={Y + 4}
              stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.5" />
        <line x1={breakX + 1} y1={Y - 4} x2={breakX + 5} y2={Y + 4}
              stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.5" />
        {/* End caps */}
        <line x1={X0} y1={Y - 4} x2={X0} y2={Y + 4}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        <line x1={X1} y1={Y - 4} x2={X1} y2={Y + 4}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />

        {/* ── HANDOFF callout from the break ─────────────────────── */}
        <line x1={breakX} y1={Y + 6} x2={breakX} y2={Y + 28}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="2 3" />
        <text x={breakX} y={Y + 40} textAnchor="middle" fontSize="6.5"
              fill="currentColor" fillOpacity="0.55"
              style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
          HANDOFF
        </text>

        {/* ── Steps ──────────────────────────────────────────────── */}
        {steps.map((s, i) => {
          const x = tickX(i)
          const isB = s.host === 'B'
          const isFinal = i === steps.length - 1
          return (
            <g key={s.n}>
              <line x1={x} y1={Y - 5} x2={x} y2={Y + 5}
                    stroke="currentColor"
                    strokeOpacity={isFinal ? 0.85 : 0.5} strokeWidth="0.5" />
              <text x={x} y={Y - 14} textAnchor="middle" fontSize="8"
                    fill="currentColor" fillOpacity={isB ? 0.9 : 0.78}
                    style={{ fontFamily: MONO }}>
                {s.name}
              </text>
              {/* committed mark — same dot for A and B; open ring for final */}
              {isFinal ? (
                <>
                  <circle cx={x} cy={Y + 18} r="3.2" fill="none"
                          className="stroke-emerald-700 dark:stroke-emerald-400"
                          strokeWidth="0.7" />
                  <circle cx={x} cy={Y + 18} r="1"
                          className="fill-emerald-700 dark:fill-emerald-400" />
                </>
              ) : (
                <circle cx={x} cy={Y + 18} r="1.5"
                        className="fill-emerald-700 dark:fill-emerald-400" />
              )}
              <text x={x} y={Y + 56} textAnchor="middle" fontSize="6.5"
                    fill="currentColor" fillOpacity="0.45"
                    style={{ fontFamily: MONO, letterSpacing: '0.2em' }}>
                {s.n}
              </text>
            </g>
          )
        })}

        {/* ── Footer annotations ─────────────────────────────────── */}
        <text x={X0} y="186" fontSize="6.5" fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
          progress&nbsp;·&nbsp;imported&nbsp;from&nbsp;checkpoint
        </text>
        <text x={X1} y="186" textAnchor="end" fontSize="6.5"
              fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em', fontStyle: 'italic' }}>
          committed&nbsp;actions&nbsp;never&nbsp;replay
        </text>
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

        {/* ── Title row ──────────────────────────────────────────── */}
        <text x="34" y="20" fontSize="7" fill="currentColor" fillOpacity="0.55"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          RECEIPT&nbsp;·&nbsp;CHAIN
        </text>
        <text x="326" y="20" textAnchor="end" fontSize="7"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          VERIFIED
        </text>

        {/* ── Vertical spine ─────────────────────────────────────── */}
        <line x1={SPINE_X} y1={Y0 - 8} x2={SPINE_X} y2={lastY + 8}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />
        <line x1={SPINE_X - 4} y1={Y0 - 8} x2={SPINE_X + 4} y2={Y0 - 8}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />

        {/* ── Receipts: ring on spine, action label, state ───────── */}
        {receipts.map((r, i) => {
          const y = ringY(i)
          const isFinal = i === receipts.length - 1
          return (
            <g key={r.action}>
              {/* ring on spine — filled with card bg so the spine line doesn't show through */}
              <circle cx={SPINE_X} cy={y} r={isFinal ? 3.6 : 2.8}
                      className={isFinal
                        ? 'fill-white dark:fill-dark-bg stroke-emerald-700 dark:stroke-emerald-400'
                        : 'fill-white dark:fill-dark-bg'}
                      stroke={isFinal ? undefined : 'currentColor'}
                      strokeOpacity={isFinal ? undefined : 0.65}
                      strokeWidth="0.7" />
              {isFinal && (
                <circle cx={SPINE_X} cy={y} r="1"
                        className="fill-emerald-700 dark:fill-emerald-400" />
              )}

              {/* branch hairline */}
              <line x1={SPINE_X + (isFinal ? 5 : 4)} y1={y} x2={SPINE_X + 24} y2={y}
                    stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.5" />

              {/* action that produced this receipt */}
              <text x={SPINE_X + 30} y={y + 2.5} fontSize="8"
                    fill="currentColor" fillOpacity={isFinal ? 0.9 : 0.82}
                    style={{ fontFamily: MONO }}>
                {r.action}
              </text>

              {/* state, right-aligned */}
              <text x="326" y={y + 2.5} textAnchor="end" fontSize="7"
                    className={r.state === 'valid' ? 'fill-emerald-700 dark:fill-emerald-400' : ''}
                    fill={r.state === 'valid' ? undefined : 'currentColor'}
                    fillOpacity={r.state === 'valid' ? undefined : 0.55}
                    style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                {r.state}
              </text>
            </g>
          )
        })}

        {/* ── End-of-chain tag ───────────────────────────────────── */}
        <line x1={SPINE_X} y1={lastY + 8} x2={SPINE_X} y2={lastY + 16}
              className="stroke-emerald-700 dark:stroke-emerald-400"
              strokeOpacity="0.55" strokeWidth="0.5" strokeDasharray="2 3" />
        <text x={SPINE_X} y={lastY + 26} textAnchor="middle" fontSize="6.5"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          CHAIN&nbsp;·&nbsp;VALID
        </text>

        {/* ── Footer annotations ─────────────────────────────────── */}
        <text x="34" y="190" fontSize="6.5" fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
          one&nbsp;receipt&nbsp;per&nbsp;committed&nbsp;action
        </text>
        <text x="326" y="190" textAnchor="end" fontSize="6.5"
              fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em', fontStyle: 'italic' }}>
          verifiable&nbsp;without&nbsp;dashboard&nbsp;trust
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

  const COL_K_X   = 60
  const COL_V_X   = 168
  const Y0        = 56
  const STEP      = 14

  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 200" className="w-full" preserveAspectRatio="xMidYMid meet">

        {/* ── Title row ──────────────────────────────────────────── */}
        <text x="34" y="20" fontSize="7" fill="currentColor" fillOpacity="0.55"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          INSPECT&nbsp;·&nbsp;RECORD&nbsp;SHEET
        </text>
        <text x="326" y="20" textAnchor="end" fontSize="7"
              className="fill-emerald-700 dark:fill-emerald-400"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          OPERATOR&nbsp;·&nbsp;READY
        </text>

        {/* ── Sheet header ───────────────────────────────────────── */}
        <text x={COL_K_X} y="42" fontSize="6"
              fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          FIELD
        </text>
        <text x={COL_V_X} y="42" fontSize="6"
              fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.24em' }}>
          VALUE
        </text>
        <line x1="34" y1="46" x2="326" y2="46"
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />

        {/* ── Rows ───────────────────────────────────────────────── */}
        {rows.map((r, i) => {
          const y = Y0 + i * STEP
          return (
            <g key={r.k}>
              <text x={COL_K_X} y={y} fontSize="7.5"
                    fill="currentColor" fillOpacity="0.5"
                    style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                {r.k}
              </text>
              <text x={COL_V_X} y={y} fontSize="9"
                    fill={r.accent ? undefined : 'currentColor'}
                    fillOpacity={r.accent ? undefined : 0.88}
                    className={r.accent ? 'fill-emerald-700 dark:fill-emerald-400' : ''}
                    style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
                {r.v}
              </text>
              {/* dotted row guideline */}
              {i < rows.length - 1 && (
                <line x1="34" y1={y + 4} x2="326" y2={y + 4}
                      stroke="currentColor" strokeOpacity="0.12"
                      strokeWidth="0.5" strokeDasharray="1 3" />
              )}
            </g>
          )
        })}

        {/* ── Closing rule ───────────────────────────────────────── */}
        <line x1="34" y1={Y0 + rows.length * STEP + 2} x2="326" y2={Y0 + rows.length * STEP + 2}
              stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.5" />

        {/* ── Footer annotations ─────────────────────────────────── */}
        <text x="34" y="190" fontSize="6.5" fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
          one&nbsp;sheet&nbsp;·&nbsp;all&nbsp;the&nbsp;truth
        </text>
        <text x="326" y="190" textAnchor="end" fontSize="6.5"
              fill="currentColor" fillOpacity="0.4"
              style={{ fontFamily: MONO, letterSpacing: '0.14em', fontStyle: 'italic' }}>
          no&nbsp;raw&nbsp;payloads&nbsp;exposed
        </text>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Card layout
// ─────────────────────────────────────────────────────────────
type Card = {
  fig: string
  status: string
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
    status: '3 ACTIONS · VERIFIED',
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
    status: 'RESUMED · NO REPLAY',
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
    status: 'CHAIN · VALID',
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
    status: 'OPERATOR · READY',
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

      <div className="mx-auto max-w-none px-3 sm:px-4 lg:px-5">
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

          {/* Proof flow strip — anchors the 2x2 below */}
          <div
            className="hidden md:flex items-center gap-3 pb-10 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO }}
          >
            {[
              'CONTROLLED ACTIONS',
              'RECORDED PROGRESS',
              'CLEAN-HOST RECOVERY',
              'SIGNED RECEIPTS',
              'OPERATOR INSPECTION',
            ].map((s, i, arr) => (
              <React.Fragment key={s}>
                <span className={i === arr.length - 1 ? 'text-emerald-700 dark:text-emerald-400' : ''}>{s}</span>
                {i < arr.length - 1 && <span className="text-gray-300 dark:text-[#3a3a32]">/</span>}
              </React.Fragment>
            ))}
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
                  <span
                    className="text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                    style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '0.22em', fontWeight: 500 }}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Visual area — fixed height so all four cards align */}
                <div
                  className="px-6 md:px-7 pt-6 pb-8 flex items-center justify-center"
                  style={{ height: 'clamp(260px, 26vw, 320px)' }}
                >
                  <div className="w-full">
                    <c.Visual />
                  </div>
                </div>

                {/* Title + body + sublist row */}
                <div className="px-7 md:px-9 pt-6 pb-8 mt-auto flex-1 flex flex-col" style={{ borderTop: borderStyle }}>
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
                        className="mt-5 self-start inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
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
