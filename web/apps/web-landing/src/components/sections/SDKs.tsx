'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

type Language = 'javascript' | 'python' | 'go' | 'rust'

const languageLabels: Record<Language, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
}

const codeExamples: Record<Language, string[]> = {
  javascript: [
    "import { IgrisClient } from '@igris-inertial/sdk';",
    '',
    'const client = new IgrisClient({',
    "  baseUrl: 'https://api.igris-inertial.com',",
    "  apiKey: 'your-api-key',",
    '});',
    '',
    'const response = await client.infer({',
    "  model: 'gpt-4',",
    "  messages: [{ role: 'user', content: 'Hello, world!' }],",
    '  max_tokens: 100,',
    '});',
    '',
    'console.log(response.choices[0].message.content);',
  ],
  python: [
    'from igris import IgrisClient, InferRequest, Message',
    '',
    'client = IgrisClient(',
    '    base_url="https://api.igris-inertial.com",',
    '    api_key="your-api-key",',
    ')',
    '',
    'response = client.infer(InferRequest(',
    '    model="gpt-4",',
    '    messages=[Message(role="user", content="Hello, world!")],',
    '    max_tokens=100,',
    '))',
    '',
    'print(response.choices[0].message.content)',
  ],
  go: [
    'import (',
    '    "context"',
    '    igris "github.com/igris-inertial/go-sdk"',
    ')',
    '',
    'client := igris.NewClient(',
    '    "https://api.igris-inertial.com",',
    '    "your-api-key",',
    ')',
    '',
    'resp, err := client.Infer(ctx, &igris.InferRequest{',
    '    Model: "gpt-4",',
    '    Messages: []igris.Message{',
    '        {Role: "user", Content: "Hello, world!"},',
    '    },',
    '})',
  ],
  rust: [
    'use igris_inertial::{IgrisClient, InferRequest, Message};',
    '',
    'let client = IgrisClient::builder("https://api.igris-inertial.com")',
    '    .api_key("your-api-key")',
    '    .build()?;',
    '',
    'let request = InferRequest {',
    '    model: "gpt-4".to_string(),',
    '    messages: vec![Message {',
    '        role: "user".to_string(),',
    '        content: "Hello, world!".to_string(),',
    '        ..Default::default()',
    '    }],',
    '    ..Default::default()',
    '};',
    '',
    'let response = client.infer(&request).await?;',
    'println!("{}", response.choices[0].message.content);',
  ],
}

function CodeBlock({ code, language }: { code: string[]; language: Language }) {
  return (
    <div className="font-mono leading-relaxed overflow-x-auto scrollbar-hide" style={{ fontSize: '0.8125rem', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {code.map((line, i) => (
        <div key={i} className="whitespace-pre">
          {line === '' ? '\u00A0' : <SyntaxLine line={line} language={language} />}
        </div>
      ))}
    </div>
  )
}

function SyntaxLine({ line, language }: { line: string; language: Language }) {
  const commentPatterns = ['//', '#', '--']
  const isComment = commentPatterns.some(p => line.trimStart().startsWith(p))
  if (isComment) return <span className="text-gray-400 dark:text-gray-500">{line}</span>

  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    const match = remaining.match(/^(.*?)(["'])(.*?)\2(.*)$/)
    if (match) {
      if (match[1]) parts.push(<span key={key++} className="text-gray-700 dark:text-gray-300">{match[1]}</span>)
      parts.push(<span key={key++} className="text-orange-700 dark:text-orange-500">{match[2]}{match[3]}{match[2]}</span>)
      remaining = match[4]
    } else {
      const highlighted = remaining
        .replace(/\b(import|from|use|async|await|const|let|var|def|fn|pub|func|try|catch|except|match|if|else|return|new|class|struct|module|require|begin|rescue|end|using|namespace)\b/g, '___KW___$1___/KW___')
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
          if (inKw) parts.push(<span key={key++} className="text-blue-800 dark:text-blue-500">{token}</span>)
          else if (inLit) parts.push(<span key={key++} className="text-orange-700 dark:text-orange-500">{token}</span>)
          else parts.push(<span key={key++} className="text-gray-700 dark:text-gray-300">{token}</span>)
        }
      }
      break
    }
  }

  return <>{parts}</>
}

export default function SDKs() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [selectedLang, setSelectedLang] = useState<Language>('javascript')
  const languages: Language[] = ['javascript', 'python', 'go', 'rust']

  useEffect(() => {
    setMounted(true)
  }, [])

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const borderStyle = '0.5px solid rgba(209, 213, 219, 0.35)'

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Title */}
          <div className="text-left" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              Connect your stack
            </h3>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: borderStyle, width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Single row - tall */}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: '480px' }}>
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start pt-8 pb-8 pr-4 md:pr-8" style={{ borderRight: borderStyle }}>
              <div className="max-w-md">
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  {languages.map((lang, i) => (
                    <React.Fragment key={lang}>
                      {i > 0 && i < languages.length - 1 && ', '}
                      {i === languages.length - 1 && ', '}
                      <button
                        onClick={() => setSelectedLang(lang)}
                        className={`underline decoration-dotted underline-offset-2 transition-colors cursor-pointer ${
                          selectedLang === lang
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {languageLabels[lang]}
                      </button>
                    </React.Fragment>
                  ))}.
                </p>

                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  One API. Drop the SDK into your existing codebase. Your app becomes deterministic, provable, survivable—without rewrite.
                </p>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  Local development matches production exactly. Test on your laptop. Deploy to servers, robots, or edge devices.
                </p>
                <div>
                  <a
                    href="https://docs.igrisinertial.com/"
                    className="text-sm text-gray-900 dark:text-[#f6f6f4] underline decoration-dotted underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    style={{ fontFamily }}
                  >
                    View SDKs
                  </a>
                </div>
              </div>
            </div>
            {/* Col 2 - Code */}
            <div className="pt-8 pb-8 pl-4 md:pl-8">
              <div className="rounded-2xl border border-gray-200 dark:border-[#f6f6f4]/8 bg-[#edece9] dark:bg-[#1b1912]/60 p-6 w-full h-[340px] overflow-auto">
                <CodeBlock code={codeExamples[selectedLang]} language={selectedLang} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
