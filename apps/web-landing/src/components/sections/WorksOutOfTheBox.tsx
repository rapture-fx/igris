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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
              {/* Left Column - Title and Description */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">APIs That Speak Your Language</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-6" style={{ color: '#114dcd' }}>
                  Upload. Train. Deploy.<br />Three API calls from messy data to production models.
                </h3>

                {/* See Industry Solutions Link */}
                <div className="mb-6">
                  <Link
                    href="/industries"
                    className="inline-flex items-center text-sm transition-all duration-200 font-medium font-inter hover:underline"
                    style={{ color: '#1f53d0' }}
                  >
                    See the industry solutions
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Right Column - Demonstration */}
              <div className="rounded-lg p-12 lg:col-span-3" style={{
                backgroundColor: '#f2f1ed',
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.025) 2px,
                  rgba(0,0,0,0.025) 4px
                )`
              }}>
                <VerticalWorkflow />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}