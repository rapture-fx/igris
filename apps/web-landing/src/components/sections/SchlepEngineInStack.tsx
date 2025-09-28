'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const pythonCode = `<code><span style="color: #114dcd;">from</span> schlep_engine <span style="color: #114dcd;">import</span> SchlepEngineClient

client = SchlepEngineClient(api_key=<span style="color: #4b5563;">"YOUR_API_KEY"</span>)

result = client.data.process_data(<span style="color: #4b5563;">"sales_data.csv"</span>)

<span style="color: #114dcd;">print</span>(result)</code>`;

const jsCode = `<code><span style="color: #114dcd;">import</span> { SchlepEngineClient } <span style="color: #114dcd;">from</span> <span style="color: #4b5563;">'@schlep-engine/javascript-sdk'</span>;

<span style="color: #114dcd;">const</span> client = <span style="color: #114dcd;">new</span> SchlepEngineClient({
  apiKey: <span style="color: #4b5563;">'YOUR_API_KEY'</span>
});

<span style="color: #114dcd;">const</span> result = <span style="color: #114dcd;">await</span> client.data.processFile(<span style="color: #4b5563;">'sales_data.csv'</span>);

console.<span style="color: #114dcd;">log</span>(result);</code>`;

const rustCode = `<code><span style="color: #114dcd;">use</span> schlep_engine::SchlepEngineClient;

<span style="color: #6b7280;">// Create client with API key</span>
<span style="color: #114dcd;">let</span> client = SchlepEngineClient::<span style="color: #114dcd;">new</span>(<span style="color: #4b5563;">"YOUR_API_KEY"</span>);

<span style="color: #6b7280;">// Process the file</span>
<span style="color: #114dcd;">let</span> result = client.data().process_file(<span style="color: #4b5563;">"sales_data.csv"</span>).<span style="color: #114dcd;">await</span>?;

<span style="color: #114dcd;">println!</span>(<span style="color: #4b5563;">"{:?}"</span>, result);</code>`;

const javaCode = `<code><span style="color: #114dcd;">import</span> com.schlepengine.SchlepEngineClient;
<span style="color: #114dcd;">import</span> com.schlepengine.ProcessResult;

<span style="color: #114dcd;">public class</span> Main {
    <span style="color: #114dcd;">public static void</span> main(String[] args) {
        SchlepEngineClient client = <span style="color: #114dcd;">new</span> SchlepEngineClient(<span style="color: #4b5563;">"YOUR_API_KEY"</span>);
        ProcessResult result = client.data().processFile(<span style="color: #4b5563;">"sales_data.csv"</span>);
        System.out.<span style="color: #114dcd;">println</span>(result);
    }
}</code>`;

const goCode = `<code><span style="color: #114dcd;">package</span> main

<span style="color: #114dcd;">import</span> (
    <span style="color: #4b5563;">"fmt"</span>
    <span style="color: #4b5563;">"github.com/schlep-engine/go-sdk"</span>
)

<span style="color: #114dcd;">func</span> main() {
    client := schlep.NewClient(<span style="color: #4b5563;">"YOUR_API_KEY"</span>)
    result, err := client.Data.ProcessFile(<span style="color: #4b5563;">"sales_data.csv"</span>)
    fmt.<span style="color: #114dcd;">Println</span>(result)
}</code>`;

const rubyCode = `<code><span style="color: #114dcd;">require</span> <span style="color: #4b5563;">'schlep_engine'</span>

client = SchlepEngine::Client.<span style="color: #114dcd;">new</span>(api_key: <span style="color: #4b5563;">'YOUR_API_KEY'</span>)

result = client.data.process_file(<span style="color: #4b5563;">'sales_data.csv'</span>)

<span style="color: #114dcd;">puts</span> result</code>`;

const dotnetCode = `<code><span style="color: #114dcd;">using</span> SchlepEngine;

<span style="color: #114dcd;">var</span> client = <span style="color: #114dcd;">new</span> SchlepEngineClient(<span style="color: #4b5563;">"YOUR_API_KEY"</span>);

<span style="color: #114dcd;">var</span> result = <span style="color: #114dcd;">await</span> client.Data.ProcessFileAsync(<span style="color: #4b5563;">"sales_data.csv"</span>);

Console.<span style="color: #114dcd;">WriteLine</span>(result);</code>`;

const cliCode = `<code><span style="color: #114dcd;">schlep</span> data process <span style="color: #4b5563;">sales_data.csv</span> <span style="color: #dc2626;">--api-key</span> <span style="color: #4b5563;">YOUR_API_KEY</span></code>`;

export default function SchlepEngineInStack() {
  const [activeTab, setActiveTab] = useState('python');

  const handleCopyClick = () => {
    const codeToCopy = getCode();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeToCopy);
    }
  };

  const getCode = () => {
    switch (activeTab) {
      case 'python':
        return pythonCode;
      case 'rust':
        return rustCode;
      case 'javascript':
        return jsCode;
      case 'java':
        return javaCode;
      case 'go':
        return goCode;
      case 'ruby':
        return rubyCode;
      case 'dotnet':
        return dotnetCode;
      case 'cli':
        return cliCode;
      default:
        return pythonCode;
    }
  }

  const getLineNumbers = () => {
    const lines = getCode().split('\n').length;
    return Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  }

  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-black text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-8" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container with Original Width */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left Column - Code Box (Placeholder Area) */}
              <div>
                <div className="rounded-lg p-12 min-h-[700px] flex items-center" style={{ backgroundColor: '#f2f1ed' }}>
                  <div className="w-full">
                    <div
                      className="text-left relative z-10 rounded-xl overflow-hidden"
                      style={{
                        backgroundColor: '#f2f1ed',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 -10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      {/* IDE-style header with window controls */}
                      <div className="flex items-center justify-between px-4 py-1 border-b border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                        <div className="flex items-center space-x-2">
                          {/* Window controls */}
                          <div className="flex space-x-2">
                            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                          </div>
                        </div>
                        <div className="absolute left-1/2 transform -translate-x-1/2">
                          <span className="text-sm text-gray-500 font-medium">Schlep-engine SDK</span>
                        </div>
                        <button
                          className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors rounded"
                          onClick={handleCopyClick}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Code area with multiple tabs */}
                      <div className="flex-1" style={{ backgroundColor: '#f2f1ed' }}>
                        {/* Multiple tabs for each language */}
                        <div className="relative flex items-end" style={{ backgroundColor: '#f2f1ed' }}>
                          {/* Horizontal divider line */}
                          <div className="absolute bottom-0 h-px bg-gray-300" style={{ left: 0, right: 0, zIndex: 1 }}></div>

                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'python'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'python' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'python' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'python' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('python')}
                          >
                            <span>Python</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'rust'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'rust' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'rust' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'rust' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('rust')}
                          >
                            <span>Rust</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'javascript'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'javascript' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'javascript' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'javascript' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('javascript')}
                          >
                            <span>Node.js</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'java'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'java' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'java' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'java' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('java')}
                          >
                            <span>Java</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'go'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'go' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'go' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'go' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('go')}
                          >
                            <span>Go</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'ruby'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'ruby' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'ruby' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'ruby' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('ruby')}
                          >
                            <span>Ruby</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'dotnet'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'dotnet' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'dotnet' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'dotnet' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('dotnet')}
                          >
                            <span>.NET</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                          <button
                            className={`flex items-center justify-between px-2 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                              activeTab === 'cli'
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            style={{
                              backgroundColor: activeTab === 'cli' ? '#f7f7f3' : 'transparent',
                              border: activeTab === 'cli' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                              borderBottom: activeTab === 'cli' ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '4px 4px 0 0',
                              minWidth: '70px',
                              zIndex: 2
                            }}
                            onClick={() => setActiveTab('cli')}
                          >
                            <span>CLI</span>
                            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                        </div>

                        {/* Code content */}
                        <div className="p-8 relative" style={{ backgroundColor: '#f7f7f3', minHeight: '400px', overflow: 'hidden' }}>
                          <div className="flex">
                            <div className="flex-1 overflow-auto">
                              <pre
                                className="text-xs font-mono leading-relaxed whitespace-pre"
                                style={{ color: '#374151' }}
                                dangerouslySetInnerHTML={{
                                  __html: getCode()
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Title, Description, Language Selection, and Button */}
              <div className="text-left flex items-center min-h-[700px]">
                <div className="w-full">
                  <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">SDKs & Integrations</h2>
                  <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-8" style={{ color: '#114dcd' }}>
                    Schlep-engine in your stack
                  </h3>

                  {/* Language Selection */}
                  <div className="flex justify-start items-center flex-wrap gap-8 mb-8">
                    <button onClick={() => setActiveTab('python')}>
                      <img src="/PYthon.svg" alt="Python" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'python' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('rust')}>
                      <img src="/RUST.svg" alt="Rust" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'rust' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('javascript')}>
                      <img src="/NODE.svg" alt="Node.js" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'javascript' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('ruby')}>
                      <img src="/Ruby.svg" alt="Ruby" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'ruby' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('java')}>
                      <img src="/Java.svg" alt="Java" className={`h-20 w-20 transition-opacity cursor-pointer ${activeTab === 'java' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('go')}>
                      <img src="/GO.svg" alt="Go" className={`h-24 w-24 transition-opacity cursor-pointer ${activeTab === 'go' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('dotnet')}>
                      <img src="/dotNET.svg" alt=".NET" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'dotnet' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                    <button onClick={() => setActiveTab('cli')}>
                      <img src="/CLI.svg" alt="CLI" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'cli' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                    </button>
                  </div>

                  {/* Explore Docs Link */}
                  <div className="text-left">
                    <Link
                      href="http://localhost:3005"
                      className="inline-flex items-center text-sm transition-all duration-200 font-medium font-inter hover:underline"
                      style={{ color: '#1f53d0' }}
                    >
                      Read more in docs
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}