'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Zap, BarChart2, Cloud, GitBranch, ArrowUpRight } from 'lucide-react'
import VerticalWorkflow from './VerticalWorkflow'

const features = [
  {
    name: 'No-code Interface',
    description: 'A simple, intuitive interface for non-technical users to clean and prepare data.',
    icon: Zap,
  },
  {
    name: 'Pre-built Templates',
    description: 'Get started quickly with pre-built templates for common data preparation tasks.',
    icon: BarChart2,
  },
  {
    name: 'Automatic Data Profiling',
    description: 'Automatically profile your data to identify quality issues and suggest transformations.',
    icon: Cloud,
  },
  {
    name: 'One-click Deployments',
    description: 'Deploy your data pipelines to production with a single click.',
    icon: GitBranch,
  },
]

const pythonCode = `from schlep_engine import SchlepEngineClient

client = SchlepEngineClient(api_key="YOUR_API_KEY")

result = client.data.process_data("sales_data.csv")

print(result)`;

const jsCode = `import { SchlepEngineClient } from '@schlep-engine/javascript-sdk';

const client = new SchlepEngineClient({
  apiKey: 'YOUR_API_KEY'
});

const result = await client.data.processFile(file);

console.log(result);`;

const goCode = `import "github.com/schlep-engine/go-sdk"

client := schlep.NewClient("YOUR_API_KEY")

result, err := client.Data.ProcessFile("sales_data.csv")

fmt.Println(result)`;

const cliCode = `schlep data process sales_data.csv --api-key YOUR_API_KEY`;

export default function WorksOutOfTheBox() {
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
      case 'javascript':
        return jsCode;
      case 'go':
        return goCode;
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
            <div className="lg:text-center mb-12">
              <div className="inline-block border border-gray-300 rounded-lg px-3 py-1.5">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 text-center font-inter">APIs That Speak Your Language</h2>
              </div>
              <p className="mt-2 text-2xl tracking-tight md:text-3xl text-center font-inter" style={{ color: '#114dcd' }}>
                Train ML Models from Raw Data in 3 Calls.
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
                Upload, train, deploy. Three API calls handle the entire ML pipeline from messy data to production models.
              </p>
            </div>

            <VerticalWorkflow />

            <div className="mt-16 max-w-4xl mx-auto">
              <h3 className="text-xl font-normal text-gray-900 dark:text-white text-center mb-8 font-inter">
                Schlep-engine in your stack
              </h3>
              <div className="flex justify-center items-center space-x-16 mb-8">
                <button onClick={() => setActiveTab('python')}>
                  <img src="/py.svg" alt="Python" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'python' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                </button>
                <button onClick={() => setActiveTab('javascript')}>
                  <img src="/node.svg" alt="JavaScript" className={`h-16 w-16 transition-opacity cursor-pointer ${activeTab === 'javascript' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                </button>
                <button onClick={() => setActiveTab('go')}>
                  <img src="/go.svg" alt="Go" className={`h-20 w-20 transition-opacity cursor-pointer ${activeTab === 'go' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                </button>
                <button onClick={() => setActiveTab('cli')}>
                  <img src="/cli.svg" alt="CLI" className={`h-14 w-14 transition-opacity cursor-pointer ${activeTab === 'cli' ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} />
                </button>
              </div>
              <div
                className="bg-white text-left shadow-lg relative z-10"
                style={{
                  border: '1px solid #114dcd',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div className="p-4 flex">
                  <div
                    className="flex-shrink-0 pr-4 text-right border-r border-gray-200 mr-4"
                    style={{ color: '#9ca3af' }}
                  >
                    <div
                      className="text-xs font-mono leading-relaxed whitespace-pre"
                    >
                      {getLineNumbers()}
                    </div>
                  </div>
                  <pre
                    className="text-xs overflow-x-auto font-mono leading-relaxed text-gray-800 whitespace-pre flex-grow"
                  >
                    {getCode()}
                  </pre>
                </div>
              </div>

              {/* Explore Docs Button */}
              <div className="mt-8 text-center">
                <Link
                  href="http://localhost:3005"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
                >
                  Explore Docs
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}