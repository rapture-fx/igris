'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

type Language = 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'ruby' | 'csharp'

const languageLabels: Record<Language, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  ruby: 'Ruby',
  csharp: 'C#',
}

const codeExamples: Record<Language, string[]> = {
  javascript: [
    "import { IgrisClient } from '@igris-inertial/javascript-sdk';",
    '',
    'const client = new IgrisClient({ apiKey: process.env.IGRIS_KEY });',
    '',
    'const result = await client.execute({',
    '  behaviorTree: "warehouse_navigation",',
    '  input: { waypoint: "A3" }',
    '});',
  ],
  python: [
    'from igris_inertial import IgrisClient',
    '',
    'client = IgrisClient(api_key="YOUR_API_KEY")',
    '',
    'result = client.execute({',
    '    "behaviorTree": "warehouse_navigation",',
    '    "input": { "waypoint": "A3" }',
    '})',
  ],
  go: [
    'import "github.com/igris-inertial/go-sdk/pkg/client"',
    '',
    'c, err := client.New("YOUR_API_KEY")',
    'if err != nil {',
    '    log.Fatal(err)',
    '}',
    '',
    'result, err := c.Execute(ctx, &client.ExecuteRequest{',
    '    BehaviorTree: "warehouse_navigation",',
    '    Input: map[string]interface{}{"waypoint": "A3"},',
    '})',
  ],
  rust: [
    'use igris_inertial::IgrisClient;',
    '',
    'let client = IgrisClient::new("YOUR_API_KEY");',
    '',
    'let result = client.execute(json!({',
    '    "behaviorTree": "warehouse_navigation",',
    '    "input": { "waypoint": "A3" }',
    '})).await?;',
  ],
  java: [
    'import io.igris.IgrisClient;',
    '',
    'IgrisClient client = new IgrisClient("YOUR_API_KEY");',
    '',
    'ExecuteResponse result = client.execute(',
    '    new ExecuteRequest()',
    '        .setBehaviorTree("warehouse_navigation")',
    '        .setInput(Map.of("waypoint", "A3"))',
    ');',
  ],
  ruby: [
    "require 'igris'",
    '',
    "client = Igris::Client.new('YOUR_API_KEY')",
    '',
    'result = client.execute(',
    "  behavior_tree: 'warehouse_navigation',",
    "  input: { waypoint: 'A3' }",
    ')',
  ],
  csharp: [
    'using Igris;',
    '',
    'var client = new IgrisClient("YOUR_API_KEY");',
    '',
    'var result = await client.ExecuteAsync(new ExecuteRequest',
    '{',
    '    BehaviorTree = "warehouse_navigation",',
    '    Input = new { waypoint = "A3" }',
    '});',
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
  const languages: Language[] = ['javascript', 'python', 'go', 'rust', 'java', 'ruby', 'csharp']

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
              Build on the Nervous System
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
                      {i === languages.length - 1 && ', and '}
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
                  All SDKs connect to the same unified execution and coordination layer. The API surface is consistent across languages, and behavior remains identical between local development and production environments.
                </p>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  Develop locally. Deploy anywhere. Same execution guarantees.
                </p>
                <div>
                  <a
                    href="https://docs.igrisinertial.com/"
                    className="text-sm text-gray-900 dark:text-[#f6f6f4] underline decoration-dotted underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    style={{ fontFamily }}
                  >
                    View SDK documentation
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
