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

const btreeExamples: Record<Language, string[]> = {
  curl: [
    '# Deploy a behavior tree',
    'curl -X POST http://localhost:8080/v1/btree/deploy \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{',
    '    "name": "patrol",',
    '    "tree": {',
    '      "type": "sequence",',
    '      "name": "patrol",',
    '      "children": [',
    '        {"type":"action","name":"scan","tool":"lidar_scan","args":{}},',
    '        {"type":"action","name":"nav","tool":"move_to",',
    '         "args":{"waypoint":"alpha"}}',
    '      ]',
    '    }',
    '  }\'',
    '',
    '# Validate a tree definition',
    'curl -X POST http://localhost:8080/v1/btree/validate \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"tree": {"type":"sequence","name":"root","children":[]}}\'',
    '',
    '# Execute a tree inline',
    'curl -X POST http://localhost:8080/v1/btree/run \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"tree": {...}, "context": {"battery_level": 80}}\'',
  ],
  javascript: [
    "import { Runtime, BehaviorTree,",
    "  SequenceNode, ActionNode } from '@igris-inertial/sdk';",
    '',
    'const runtime = new Runtime({',
    "  localUrl: 'http://localhost:8080',",
    '});',
    '',
    "const tree = BehaviorTree.fromJson(",
    "  new SequenceNode('patrol', [",
    "    new ActionNode('scan_area', 'lidar_scan', { mode: 'full' }),",
    "    new ActionNode('navigate', 'move_to', { waypoint: 'alpha' }),",
    "    new ActionNode('report_status', 'log_status'),",
    '  ]).toJSON(),',
    '  runtime,',
    ');',
    '',
    'const result = await tree.validate();',
    "// { valid: true, root_type: 'sequence' }",
    '',
    'const execution = await tree.run();',
    "// { status: 'success', tick_count: 3 }",
  ],
  python: [
    'from igris import Runtime, RuntimeConfig',
    'from igris.btree import BehaviorTree, Sequence, Action',
    '',
    'runtime = Runtime(RuntimeConfig(',
    '    local_url="http://localhost:8080",',
    '))',
    '',
    'tree = BehaviorTree.from_nodes(',
    '    Sequence("patrol", [',
    '        Action("scan_area", "lidar_scan", {"mode": "full"}),',
    '        Action("navigate", "move_to", {"waypoint": "alpha"}),',
    '        Action("report_status", "log_status"),',
    '    ]),',
    '    runtime,',
    ')',
    '',
    'result = tree.validate()',
    '# {\'valid\': True, \'root_type\': \'sequence\'}',
    '',
    'execution = tree.run()',
    '# {\'status\': \'success\', \'tick_count\': 3}',
  ],
  go: [
    'package main',
    '',
    'import (',
    '    "context"',
    '    "fmt"',
    '    "log"',
    '    igris "github.com/igris-inertial/go-sdk"',
    ')',
    '',
    'func main() {',
    '    ctx := context.Background()',
    '    runtime := igris.NewRuntime("http://localhost:8080")',
    '',
    '    tree := igris.NewBehaviorTree(',
    '        igris.NewSequenceNode("patrol",',
    '            igris.NewActionNode("scan_area", "lidar_scan",',
    '                map[string]interface{}{"mode": "full"}),',
    '            igris.NewActionNode("navigate", "move_to",',
    '                map[string]interface{}{"waypoint": "alpha"}),',
    '            igris.NewActionNode("report_status", "log_status", nil),',
    '        ),',
    '        runtime,',
    '    )',
    '',
    '    result, err := tree.Validate(ctx)',
    '    if err != nil {',
    '        log.Fatal(err)',
    '    }',
    '    fmt.Println(result.Valid)',
    '',
    '    execution, err := tree.Run(ctx, nil)',
    '    if err != nil {',
    '        log.Fatal(err)',
    '    }',
    '    fmt.Println(execution.Status)',
    '}',
  ],
  rust: [
    'use igris_inertial::{BehaviorTree, BTreeRunOptions, Runtime};',
    'use igris_inertial::btree::{action_node, sequence_node};',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let runtime = Runtime::builder("http://localhost:8080")',
    '        .build()?;',
    '',
    '    let tree = BehaviorTree::new(',
    '        sequence_node("patrol", vec![',
    '            action_node("scan_area", "lidar_scan",',
    '                serde_json::json!({"mode": "full"})),',
    '            action_node("navigate", "move_to",',
    '                serde_json::json!({"waypoint": "alpha"})),',
    '            action_node("report_status", "log_status",',
    '                serde_json::json!({})),',
    '        ]),',
    '        &runtime,',
    '    );',
    '',
    '    let result = tree.validate().await?;',
    '    println!("{:?}", result.valid);',
    '',
    '    let execution = tree.run(BTreeRunOptions::default()).await?;',
    '    println!("{}", execution.status);',
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

    const DURATION = 900

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

  return (
    <section ref={sectionRef} className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Title */}
          <div className="text-left py-6 md:py-12">
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              Connect your stack
            </h3>
          </div>
        </div>
      </div>

      {/* Full-width border between rows */}
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Row 1 - API SDK */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:[min-height:280px]">
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)] dark:border-[rgba(246,246,244,0.06)]">
              <div className="max-w-md">
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  {languages.map((lang, i) => (
                    <React.Fragment key={lang}>
                      {i > 0 && i < languages.length - 1 && ', '}
                      {i === languages.length - 1 && ', '}
                      <button
                        onClick={() => handleLangChange(lang)}
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

                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  One API for governed AI execution.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  Send AI tasks from your existing codebase and receive structured responses with execution metadata, signed records, and verification-ready artifacts.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  Point the client at the execution surface you use. The request shape stays consistent.
                </p>
                <div>
                  <a
                    href="https://docs.igrisinertial.com/docs/sdk/"
                    className="text-sm text-gray-900 dark:text-[#f6f6f4] underline decoration-dotted underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    style={{ fontFamily }}
                  >
                    View SDKs
                  </a>
                </div>
              </div>
            </div>
            {/* Col 2 - Code */}
            <div className="relative min-h-[320px] md:min-h-0">
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a] flex flex-col">
                <div className="px-4 pt-2.5 pb-2 flex items-center justify-between shrink-0" style={{ fontFamily }}>
                  <span className="text-xs font-medium text-black dark:text-[#f6f6f4]">{languageLabels[selectedLang]}</span>
                  <CopyButton code={codeExamples[selectedLang]} />
                </div>
                <div className="bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl px-6 py-4 flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <AnimatedCodeBlock code={codeExamples[selectedLang]} animKey={animKey} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width border between rows */}
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Row 2 - Behavior Trees */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:[min-height:280px]">
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)] dark:border-[rgba(246,246,244,0.06)]">
              <div className="max-w-md">
                <h4 className="text-lg md:text-xl lg:text-2xl text-[#000000] dark:text-[#f6f6f4] mb-4" style={{ fontFamily }}>
                  Structured execution
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  Define how AI output becomes action.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  Use structured paths to coordinate multi-step tasks, approvals, tool calls, and recovery logic. Keep model reasoning flexible while execution stays bounded, inspectable, and reviewable.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  For teams building long-running agents, approvals, and tool-driven workflows that need clear execution boundaries.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  These examples target a local Igris Runtime at <code className="text-[0.95em]">http://localhost:8080</code>, not the hosted Overture API.
                </p>
                <div>
                  <a
                    href="https://docs.igrisinertial.com/docs/behavior-trees/"
                    className="text-sm text-gray-900 dark:text-[#f6f6f4] underline decoration-dotted underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    style={{ fontFamily }}
                  >
                    View execution model
                  </a>
                </div>
              </div>
            </div>
            {/* Col 2 - Code */}
            <div className="relative min-h-[320px] md:min-h-0">
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a] flex flex-col">
                <div className="px-4 pt-2.5 pb-2 flex items-center justify-between shrink-0" style={{ fontFamily }}>
                  <span className="text-xs font-medium text-black dark:text-[#f6f6f4]">{languageLabels[selectedLang]}</span>
                  <CopyButton code={btreeExamples[selectedLang]} />
                </div>
                <div className="bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl px-6 py-4 flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <AnimatedCodeBlock code={btreeExamples[selectedLang]} animKey={animKey} />
                </div>
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
