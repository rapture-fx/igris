
import React from 'react'
import { Zap, BarChart2, Lock, DollarSign, Cloud, GitBranch, Activity, Users, MessageSquare } from 'lucide-react'

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

export default function WorksOutOfTheBox() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-gray-50 dark:bg-black text-gray-900 dark:text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-[#1A5799] text-center font-inter">Works out of the box</h2>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white md:text-3xl text-center font-inter">
            Data preparation for everyone.
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
            Schlep-engine is designed to be easy to use for everyone, from data scientists to business analysts.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg dark:bg-gray-800">
                    <feature.icon className="h-6 w-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-700 dark:text-gray-400">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <div className="flex gap-1 mb-0">
            <button
              className="px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0"
              id="python-tab-sdk"
              onClick={() => {
                document.getElementById('python-tab-sdk').className = "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0";
                document.getElementById('js-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('go-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('cli-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('code-content-sdk').innerHTML = `<code><span style="color: #114dcd;">import</span> schlep_engine

schlep = schlep_engine.Schlep(api_key="YOUR_API_KEY")

result = schlep.process_file("my_file.pdf")

print(result)</code>`;
              }}
            >
              Python
            </button>
            <button
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0"
              id="js-tab-sdk"
              onClick={() => {
                document.getElementById('python-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('js-tab-sdk').className = "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0";
                document.getElementById('go-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('cli-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('code-content-sdk').innerHTML = `<code><span style="color: #114dcd;">import</span> { Schlep } from 'schlep-engine';

const schlep = new Schlep({ apiKey: 'YOUR_API_KEY' });

const result = await schlep.processFile('my_file.pdf');

console.log(result);</code>`;
              }}
            >
              JavaScript
            </button>
            <button
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0"
              id="go-tab-sdk"
              onClick={() => {
                document.getElementById('python-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('js-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('go-tab-sdk').className = "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0";
                document.getElementById('cli-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('code-content-sdk').innerHTML = `<code><span style="color: #114dcd;">import</span> "github.com/schlep-engine/schlep-go"

schlep := schlep.New(schlep.WithAPIKey("YOUR_API_KEY"))

result, err := schlep.ProcessFile("my_file.pdf")

fmt.Println(result)</code>`;
              }}
            >
              Go
            </button>
            <button
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0"
              id="cli-tab-sdk"
              onClick={() => {
                document.getElementById('python-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('js-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('go-tab-sdk').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('cli-tab-sdk').className = "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0";
                document.getElementById('code-content-sdk').innerHTML = `<code>$ schlep process_file my_file.pdf --api-key YOUR_API_KEY</code>`;
              }}
            >
              CLI
            </button>
          </div>
          <div
            className="bg-white text-left shadow-lg relative"
            style={{
              border: '1px solid #114dcd',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="p-4 flex">
              <pre
                className="text-xs overflow-x-auto font-mono leading-relaxed text-gray-800 whitespace-pre flex-grow"
                id="code-content-sdk"
                dangerouslySetInnerHTML={{ __html: `<code><span style="color: #114dcd;">import</span> schlep_engine

schlep = schlep_engine.Schlep(api_key="YOUR_API_KEY")

result = schlep.process_file("my_file.pdf")

print(result)</code>` }}
              ></pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
