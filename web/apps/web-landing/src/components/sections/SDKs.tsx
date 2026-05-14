'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

type Language = 'javascript' | 'python' | 'go' | 'rust' | 'curl'

const languageLabels: Record<Language, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  curl: 'cURL',
}

const codeExamples: Record<Language, string[]> = {
  curl: [
    '# Send one request through Igris',
    'curl -X POST https://overture.igrisinertial.com/v1/infer \\',
    '  -H "Authorization: Bearer $IGRIS_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{',
    '    "model": "gpt-4",',
    '    "messages": [{"role": "user", "content": "Summarize the latest task result."}],',
    '    "max_tokens": 100,',
    '    "metadata": {"workflow": "ops-review"}',
    '  }\'',
    '',
    '# Inspect execution metadata from the response',
    '# provider: response.metadata.provider',
    '# latency: response.metadata.latency_ms',
    '# receipt hash: response.receipt.receipt_hash',
  ],
  javascript: [
    "import { IgrisClient } from '@igris-inertial/sdk';",
    '',
    'const client = new IgrisClient({',
    "  baseUrl: 'https://overture.igrisinertial.com',",
    "  apiKey: process.env.IGRIS_API_KEY,",
    '});',
    '',
    'const response = await client.infer({',
    "  model: 'gpt-4',",
    "  messages: [{ role: 'user', content: 'Summarize the latest task result.' }],",
    '  max_tokens: 100,',
    "  metadata: { workflow: 'ops-review' },",
    '});',
    '',
    'console.log(response.choices[0].message.content);',
    "console.log('Provider:', response.metadata?.provider);",
    "console.log('Latency:', response.metadata?.latency_ms);",
    "console.log('Receipt Hash:', response.receipt?.receipt_hash);",
  ],
  python: [
    'import os',
    'from igris import IgrisClient, InferRequest, Message',
    '',
    'client = IgrisClient(',
    '    base_url="https://overture.igrisinertial.com",',
    '    api_key=os.environ["IGRIS_API_KEY"],',
    ')',
    '',
    'response = client.infer(InferRequest(',
    '    model="gpt-4",',
    '    messages=[Message(role="user", content="Summarize the latest task result.")],',
    '    max_tokens=100,',
    '    metadata={"workflow": "ops-review"},',
    '))',
    '',
    'print(response.choices[0].message.content)',
    'print(response.metadata.provider if response.metadata else None)',
    'print(response.metadata.latency_ms if response.metadata else None)',
    'print(response.receipt.receipt_hash if response.receipt else None)',
  ],
  go: [
    'package main',
    '',
    'import (',
    '    "context"',
    '    "fmt"',
    '    "log"',
    '    "os"',
    '    igris "github.com/igris-inertial/go-sdk"',
    ')',
    '',
    'func main() {',
    '    ctx := context.Background()',
    '    client := igris.NewClient(',
    '        "https://overture.igrisinertial.com",',
    '        os.Getenv("IGRIS_API_KEY"),',
    '    )',
    '',
    '    resp, err := client.Infer(ctx, &igris.InferRequest{',
    '        Model: "gpt-4",',
    '        Messages: []igris.Message{',
    '            {Role: "user", Content: "Summarize the latest task result."},',
    '        },',
    '        Metadata: map[string]string{"workflow": "ops-review"},',
    '    })',
    '    if err != nil {',
    '        log.Fatal(err)',
    '    }',
    '',
    '    fmt.Println(resp.Choices[0].Message.Content)',
    '    if resp.Metadata != nil {',
    '        fmt.Println(resp.Metadata.Provider)',
    '        fmt.Println(resp.Metadata.LatencyMs)',
    '    }',
    '    if resp.Receipt != nil {',
    '        fmt.Println(resp.Receipt.ReceiptHash)',
    '    }',
    '}',
  ],
  rust: [
    'use igris_inertial::{IgrisClient, InferRequest, Message};',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = IgrisClient::builder("https://overture.igrisinertial.com")',
    '        .api_key(std::env::var("IGRIS_API_KEY")?)',
    '        .build()?;',
    '',
    '    let response = client.infer(&InferRequest {',
    '        model: "gpt-4".to_string(),',
    '        messages: vec![Message {',
    '            role: "user".to_string(),',
    '            content: "Summarize the latest task result.".to_string(),',
    '            content_parts: None,',
    '        }],',
    '        max_tokens: Some(100),',
    '        metadata: Some(std::collections::HashMap::from([',
    '            ("workflow".to_string(), "ops-review".to_string()),',
    '        ])),',
    '        ..Default::default()',
    '    }).await?;',
    '',
    '    println!("{}", response.choices[0].message.content);',
    '    println!("{:?}", response.metadata.as_ref().and_then(|m| m.provider.as_ref()));',
    '    println!("{:?}", response.metadata.as_ref().and_then(|m| m.latency_ms));',
    '    println!("{:?}", response.receipt.as_ref().and_then(|r| r.receipt_hash.as_deref()));',
    '    Ok(())',
    '}',
  ],
}

function CopyButton({ code }: { code: string[] }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="p-1.5 rounded transition-opacity hover:opacity-60"
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_-+={}|;<>?/'

function AnimatedCodeBlock({ code, animKey }: { code: string[]; animKey: number }) {
  const [lines, setLines] = useState<string[]>([])
  const [isDone, setIsDone] = useState(false)
  const rafRef = useRef<number>()
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setIsDone(false)
    cancelAnimationFrame(rafRef.current!)
    clearTimeout(timerRef.current)

    const DURATION = 400

    function scrambleAll(): string[] {
      return code.map(line =>
        line === '' ? '' : line.split('').map(c => c === ' ' ? ' ' : POOL[Math.floor(Math.random() * POOL.length)]).join('')
      )
    }

    let start = -1

    function frame(ts: number) {
      if (start < 0) start = ts
      if (ts - start >= DURATION) {
        setLines([...code])
        setIsDone(true)
      } else {
        setLines(scrambleAll())
        rafRef.current = requestAnimationFrame(frame)
      }
    }

    timerRef.current = setTimeout(() => {
      setLines(scrambleAll())
      rafRef.current = requestAnimationFrame(frame)
    }, 100)

    return () => {
      cancelAnimationFrame(rafRef.current!)
      clearTimeout(timerRef.current)
    }
  }, [animKey, code])

  return (
    <div className="font-mono" style={{ fontSize: '0.8125rem' }}>
      <div className="leading-relaxed overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre">
            {line === '' ? ' ' : isDone
              ? <SyntaxLine line={line} />
              : <span className="text-[#bbb] dark:text-[#555]">{line}</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

function SyntaxLine({ line }: { line: string }) {
  const commentPatterns = ['//', '#', '--']
  const isComment = commentPatterns.some(p => line.trimStart().startsWith(p))
  if (isComment) return <span className="text-[#6a737d] dark:text-[#6a737d]">{line}</span>

  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    const match = remaining.match(/^(.*?)(["'])(.*?)\2(.*)$/)
    if (match) {
      if (match[1]) parts.push(<span key={key++} className="text-[#24292e] dark:text-[#e1e4e8]">{match[1]}</span>)
      parts.push(<span key={key++} className="text-[#032f62] dark:text-[#9ecbff]">{match[2]}{match[3]}{match[2]}</span>)
      remaining = match[4]
    } else {
      const highlighted = remaining
        .replace(/\b(import|from|use|async|await|const|let|var|def|fn|pub|func|try|catch|except|match|if|else|return|new|class|struct|module|require|begin|rescue|end|using|namespace|curl)\b/g, '___KW___$1___/KW___')
        .replace(/\b(true|false|nil|null|None|Ok|Err|Some)\b/g, '___LIT___$1___/LIT___')

      const tokens = highlighted.split(/(___KW___|___\/KW___|___LIT___|___\/LIT___)/g)
      let inKw = false
      let inLit = false
      for (const token of tokens) {
        if (token === '___KW___') { inKw = true; continue }
        if (token === '___/KW___') { inKw = false; continue }
        if (token === '___LIT___') { inLit = true; continue }
        if (token === '___/LIT___') { inLit = false; continue }
        if (token) {
          if (inKw) parts.push(<span key={key++} className="text-[#d73a49] dark:text-[#f97583]">{token}</span>)
          else if (inLit) parts.push(<span key={key++} className="text-[#005cc5] dark:text-[#79b8ff]">{token}</span>)
          else parts.push(<span key={key++} className="text-[#24292e] dark:text-[#e1e4e8]">{token}</span>)
        }
      }
      break
    }
  }

  return <>{parts}</>
}

export default function SDKs() {
  const [selectedLang, setSelectedLang] = useState<Language>('javascript')
  const [animKey, setAnimKey] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const languages: Language[] = ['javascript', 'python', 'go', 'rust', 'curl']

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const borderStyle = 'var(--section-border)'

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimKey(k => k + 1) },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleLangChange = useCallback((lang: Language) => {
    setSelectedLang(lang)
    setAnimKey(k => k + 1)
  }, [])

  const MONO_FAMILY = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
  const listingIdx = languages.indexOf(selectedLang)
  const listingLetter = String.fromCharCode(65 + (listingIdx >= 0 ? listingIdx : 0))

  return (
    <section ref={sectionRef} className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Section anchor */}
          <div className="flex items-baseline justify-between pt-10 md:pt-14 pb-3">
            <span className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO_FAMILY }}>
              05&nbsp;&nbsp;INTERFACE
            </span>
            <span className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO_FAMILY }}>
              FIG.05
            </span>
          </div>

          {/* Headline + caption */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-8 md:gap-x-12 pt-10 md:pt-16 pb-10 md:pb-12">
            <div className="md:col-span-7">
              <h2
                className="text-[#000000] dark:text-[#f6f6f4]"
                style={{
                  fontFamily,
                  fontWeight: 500,
                  fontSize: 'clamp(2rem, 5.2vw, 3.75rem)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.025em',
                }}
              >
                One request.
                <br />
                Same shape,
                <br />
                every surface.
              </h2>
            </div>
            <div className="md:col-span-5 md:pt-3">
              <p
                className="text-gray-700 dark:text-[#c8c8b8] max-w-[34ch]"
                style={{ fontFamily, fontSize: '0.95rem', lineHeight: 1.65 }}
              >
                Send AI tasks from your existing codebase and receive structured
                responses with execution metadata, signed records, and
                verification-ready artifacts.
              </p>
              <a
                href="https://docs.igrisinertial.com/docs/sdk/"
                className="group mt-6 inline-flex items-baseline gap-2 text-[#000000] dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
                style={{ fontFamily: MONO_FAMILY, fontSize: '12px', letterSpacing: '0.22em' }}
              >
                <span aria-hidden className="inline-block w-5 border-t border-current translate-y-[-3px]" />
                VIEW&nbsp;ALL&nbsp;SDKs
                <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-0.5">↗</span>
              </a>
            </div>
          </div>

          <div style={{ borderTop: borderStyle }} />

          {/* Listing header */}
          <div className="flex flex-wrap items-baseline gap-y-3 justify-between gap-x-6 pt-6 md:pt-8 pb-3">
            <span className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO_FAMILY }}>
              LISTING&nbsp;05.{listingLetter}
              <span className="mx-2 text-gray-300 dark:text-[#3a3a32]">·</span>
              {languageLabels[selectedLang].toUpperCase()}
            </span>

            {/* language switcher */}
            <div
              className="flex items-baseline gap-x-4 gap-y-2 flex-wrap"
              style={{ fontFamily: MONO_FAMILY, fontSize: '11px', letterSpacing: '0.22em' }}
            >
              {languages.map((lang) => {
                const active = lang === selectedLang
                return (
                  <button
                    key={lang}
                    onClick={() => handleLangChange(lang)}
                    className={`transition-colors ${
                      active
                        ? 'text-[#000000] dark:text-[#f6f6f4]'
                        : 'text-gray-400 dark:text-[#5a5a52] hover:text-gray-700 dark:hover:text-[#c8c8b8]'
                    }`}
                    style={{
                      paddingBottom: '2px',
                      borderBottom: active ? '1px solid currentColor' : '1px solid transparent',
                    }}
                  >
                    {languageLabels[lang].toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Code listing — hairline framed */}
          <div className="pb-10 md:pb-16">
            <div style={{ borderTop: borderStyle, borderBottom: borderStyle }}>
              <div className="relative">
                <div className="absolute top-2 right-3 z-10">
                  <CopyButton code={codeExamples[selectedLang]} />
                </div>
                <div
                  className="px-5 md:px-8 py-5 md:py-7 overflow-x-auto"
                  style={{ background: 'transparent' }}
                >
                  <AnimatedCodeBlock code={codeExamples[selectedLang]} animKey={animKey} />
                </div>
              </div>
            </div>

            {/* Footer assertion */}
            <div
              className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-3 pt-5"
              style={{ fontFamily: MONO_FAMILY, fontSize: '11px', letterSpacing: '0.22em' }}
            >
              <span className="text-gray-900 dark:text-[#f6f6f4]">
                REQUEST&nbsp;SHAPE&nbsp;—&nbsp;INVARIANT
                <span className="mx-3 text-gray-400 dark:text-[#5a5a52]">·</span>
                METADATA&nbsp;+&nbsp;RECEIPT&nbsp;ATTACHED
              </span>
              <span className="text-gray-500 dark:text-[#8a8a7a]">5&nbsp;LANGUAGES&nbsp;·&nbsp;1&nbsp;API</span>
            </div>
          </div>

        </div>
      </div>

      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
