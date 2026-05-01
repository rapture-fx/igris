'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

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
    '# Cloud inference',
    'curl -X POST https://overture.igrisinertial.com/v1/infer \\',
    '  -H "Authorization: Bearer $IGRIS_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{',
    '    "model": "gpt-4",',
    '    "messages": [{"role": "user", "content": "Plan a route."}],',
    '    "max_tokens": 100',
    '  }\'',
    '',
    '# Local runtime (OpenAI-compatible)',
    'curl -X POST http://localhost:8080/v1/chat/completions \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{',
    '    "model": "llama-3-8b",',
    '    "messages": [{"role": "user", "content": "Hello"}]',
    '  }\'',
    '',
    '# Deploy a behavior tree',
    'curl -X POST http://localhost:8080/v1/btree/deploy \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{',
    '    "name": "patrol",',
    '    "tree": {"type": "sequence", "children": [...]},',
    '    "description": "Patrol and report"',
    '  }\'',
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
    "  messages: [{ role: 'user', content: 'Plan a route.' }],",
    '  max_tokens: 100,',
    '});',
    '',
    'console.log(response.choices[0].message.content);',
    '',
    '// Local runtime with cloud fallback',
    "import { Runtime } from '@igris-inertial/sdk';",
    '',
    'const runtime = new Runtime({',
    "  localUrl: 'http://localhost:8080',",
    "  cloudUrl: 'https://overture.igrisinertial.com',",
    '  autoFallback: true,',
    '});',
    '',
    'const local = await runtime.chat({',
    "  model: 'llama-3-8b',",
    "  messages: [{ role: 'user', content: 'Hello' }],",
    '});',
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
    '    messages=[Message(role="user", content="Plan a route.")],',
    '    max_tokens=100,',
    '))',
    '',
    'print(response.choices[0].message.content)',
    '',
    '# Local runtime with cloud fallback',
    'from igris import Runtime, RuntimeConfig',
    '',
    'runtime = Runtime(RuntimeConfig(',
    '    local_url="http://localhost:8080",',
    '    cloud_url="https://overture.igrisinertial.com",',
    '    auto_fallback=True,',
    '))',
    '',
    'local = runtime.chat(InferRequest(',
    '    model="llama-3-8b",',
    '    messages=[Message(role="user", content="Hello")],',
    '))',
  ],
  go: [
    'import (',
    '    "context"',
    '    igris "github.com/igris-inertial/go-sdk"',
    ')',
    '',
    'client := igris.NewClient(',
    '    "https://overture.igrisinertial.com",',
    '    os.Getenv("IGRIS_API_KEY"),',
    ')',
    '',
    'resp, err := client.Infer(ctx, &igris.InferRequest{',
    '    Model: "gpt-4",',
    '    Messages: []igris.Message{',
    '        {Role: "user", Content: "Plan a route."},',
    '    },',
    '})',
    '',
    '// Local runtime with cloud fallback',
    'runtime := igris.NewRuntime(',
    '    "http://localhost:8080",',
    '    igris.WithCloudURL("https://overture.igrisinertial.com"),',
    '    igris.WithAutoFallback(true),',
    ')',
    '',
    'local, err := runtime.Chat(ctx, &igris.InferRequest{',
    '    Model: "llama-3-8b",',
    '    Messages: []igris.Message{',
    '        {Role: "user", Content: "Hello"},',
    '    },',
    '})',
  ],
  rust: [
    'use igris_inertial::{IgrisClient, InferRequest, Message};',
    '',
    'let client = IgrisClient::builder("https://overture.igrisinertial.com")',
    '    .api_key(std::env::var("IGRIS_API_KEY")?)',
    '    .build()?;',
    '',
    'let response = client.infer(&InferRequest {',
    '    model: "gpt-4".into(),',
    '    messages: vec![Message {',
    '        role: "user".into(),',
    '        content: "Plan a route.".into(),',
    '        ..Default::default()',
    '    }],',
    '    ..Default::default()',
    '})',
    '.await?;',
    '',
    '// Local runtime with cloud fallback',
    'use igris_inertial::Runtime;',
    '',
    'let runtime = Runtime::builder("http://localhost:8080")',
    '    .cloud_url("https://overture.igrisinertial.com")',
    '    .auto_fallback(true)',
    '    .build()?;',
    '',
    'let local = runtime.chat(&InferRequest {',
    '    model: "llama-3-8b".into(),',
    '    messages: vec![Message {',
    '        role: "user".into(),',
    '        content: "Hello".into(),',
    '        ..Default::default()',
    '    }],',
    '    ..Default::default()',
    '}).await?;',
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
    'import igris "github.com/igris-inertial/go-sdk"',
    '',
    'runtime := igris.NewRuntime("http://localhost:8080")',
    '',
    'tree := igris.NewBehaviorTree(',
    '    igris.NewSequenceNode("patrol",',
    '        igris.NewActionNode("scan_area", "lidar_scan",',
    '            map[string]interface{}{"mode": "full"}),',
    '        igris.NewActionNode("navigate", "move_to",',
    '            map[string]interface{}{"waypoint": "alpha"}),',
    '        igris.NewActionNode("report_status", "log_status", nil),',
    '    ),',
    '    runtime,',
    ')',
    '',
    'result, err := tree.Validate(ctx)',
    '// result.Valid == true',
    '',
    'execution, err := tree.Run(ctx, nil)',
    '// execution.Status == "success"',
  ],
  rust: [
    'use igris_inertial::{Runtime, BehaviorTree};',
    'use igris_inertial::btree::{sequence_node, action_node};',
    '',
    'let runtime = Runtime::builder("http://localhost:8080")',
    '    .build()?;',
    '',
    'let tree = BehaviorTree::new(sequence_node("patrol", vec![',
    '    action_node("scan_area", "lidar_scan",',
    '        serde_json::json!({"mode": "full"})),',
    '    action_node("navigate", "move_to",',
    '        serde_json::json!({"waypoint": "alpha"})),',
    '    action_node("report_status", "log_status",',
    '        serde_json::Value::Null),',
    ']), &runtime);',
    '',
    'let result = tree.validate().await?;',
    '// result.valid == true',
    '',
    'let execution = tree.run(None).await?;',
    '// execution.status == "success"',
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
      className="absolute top-3 right-3 z-10 p-1.5 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

function CodeBlock({ code, language }: { code: string[]; language: Language }) {
  return (
    <div className="font-mono" style={{ fontSize: '0.8125rem' }}>
      <div className="leading-relaxed overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {code.map((line, i) => (
          <div key={i} className="whitespace-pre">
            {line === '' ? '\u00A0' : <SyntaxLine line={line} language={language} />}
          </div>
        ))}
      </div>
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
  const languages: Language[] = ['javascript', 'python', 'go', 'rust', 'curl']

  useEffect(() => {
    setMounted(true)
  }, [])

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const borderStyle = '0.5px solid rgba(209, 213, 219, 0.35)'

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
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

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Row 1 - Cloud + Runtime SDK */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:[min-height:280px]">
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)]">
              <div className="max-w-md">
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
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

                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  One API. Drop the SDK into your existing codebase. Your app becomes deterministic, provable, survivable—without rewrite.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  Local runtime with automatic cloud fallback. Test on your laptop. Deploy to servers, robots, or edge devices.
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
            <div className="relative min-h-[240px] md:min-h-0">
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-2xl border border-gray-200 dark:border-[rgba(246,246,244,0.08)] bg-[#f9f9fa] dark:bg-[rgba(246,246,244,0.05)] px-8 py-6 overflow-hidden shadow-sm">
                <CopyButton code={codeExamples[selectedLang]} />
                <div className="h-full overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <CodeBlock code={codeExamples[selectedLang]} language={selectedLang} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width border between rows */}
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Row 2 - Behavior Trees */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:[min-height:280px]">
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)]">
              <div className="max-w-md">
                <h4 className="text-lg md:text-xl lg:text-2xl text-[#000000] dark:text-[#f6f6f4] mb-4" style={{ fontFamily }}>
                  Behavior Trees
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily }}>
                  Define, validate, and execute behavior trees programmatically. Compose sequences, selectors, and actions into autonomous workflows that run locally on the runtime.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily }}>
                  Deploy trees to devices. Validate client-side and server-side. Get signed execution traces for every run.
                </p>
                <div>
                  <a
                    href="https://docs.igrisinertial.com/docs/behavior-trees/"
                    className="text-sm text-gray-900 dark:text-[#f6f6f4] underline decoration-dotted underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    style={{ fontFamily }}
                  >
                    BTree
                  </a>
                </div>
              </div>
            </div>
            {/* Col 2 - Code */}
            <div className="relative min-h-[240px] md:min-h-0">
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-2xl border border-gray-200 dark:border-[rgba(246,246,244,0.08)] bg-[#f9f9fa] dark:bg-[rgba(246,246,244,0.05)] px-8 py-6 overflow-hidden shadow-sm">
                <CopyButton code={btreeExamples[selectedLang]} />
                <div className="h-full overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <CodeBlock code={btreeExamples[selectedLang]} language={selectedLang} />
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
