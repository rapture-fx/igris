import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'
import Link from 'next/link'
import { CodeBracketIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

export default function SDKsPage() {
  const sdks = [
    {
      name: "Python SDK",
      description: "The most feature-complete SDK with pandas integration, Jupyter widgets, and ML framework exports.",
      href: "/docs/sdks/python",
      language: "Python",
      features: ["DataFrame processing", "Jupyter widgets", "ML framework export", "Async support"],
      installation: "pip install schlep-engine",
      example: `import schlep_engine as se

client = se.Client(api_key="your-key")
result = client.process_dataframe(df)
clean_df = result.to_dataframe()`
    },
    {
      name: "JavaScript SDK",
      description: "Perfect for Node.js applications and browser-based data processing with TypeScript support.",
      href: "/docs/sdks/javascript",
      language: "JavaScript/TypeScript",
      features: ["Node.js & Browser", "TypeScript support", "Promise-based", "File upload"],
      installation: "npm install @schlep-engine/js-sdk",
      example: `import SchlepEngine from '@schlep-engine/js-sdk';

const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY
});

const result = await client.processData(data);`
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">
                  SDKs & Libraries
                </h1>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Official SDKs to integrate schlep-engine into your applications with just a few lines of code.
                </p>
              </div>

              <div className="space-y-12">
                {sdks.map((sdk, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{sdk.name}</h2>
                        <p className="text-gray-600 mb-4">{sdk.description}</p>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {sdk.language}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={sdk.href}
                        className="inline-flex items-center gap-2 bg-[#1A5799] text-white px-4 py-2 rounded-lg hover:bg-[#1e3a8a] transition-colors"
                      >
                        View Docs
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Features</h3>
                        <ul className="space-y-2">
                          {sdk.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-center text-gray-600">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                              {feature}
                            </li>
                          ))}
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Installation</h3>
                        <div className="bg-gray-900 rounded-lg p-4">
                          <code className="text-green-400 font-mono text-sm">{sdk.installation}</code>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Example</h3>
                        <div className="bg-gray-900 rounded-lg p-4">
                          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                            {sdk.example}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 bg-blue-50 rounded-lg p-8">
                <div className="text-center">
                  <CodeBracketIcon className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Need Another Language?
                  </h2>
                  <p className="text-gray-600 mb-6">
                    We're working on SDKs for more languages. In the meantime, you can use our REST API directly.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      href="/docs/api-reference"
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View REST API
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Request SDK
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-16">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                  Community & Support
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">GitHub Repositories</h3>
                    <p className="text-gray-600 mb-4">
                      Contribute to our open-source SDKs, report issues, and see examples.
                    </p>
                    <div className="space-y-2">
                      <a href="https://github.com/schlep-engine/python-sdk" className="block text-blue-600 hover:underline text-sm">
                        → schlep-engine/python-sdk
                      </a>
                      <a href="https://github.com/schlep-engine/javascript-sdk" className="block text-blue-600 hover:underline text-sm">
                        → schlep-engine/javascript-sdk
                      </a>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Community Examples</h3>
                    <p className="text-gray-600 mb-4">
                      Explore community-contributed examples and use cases.
                    </p>
                    <div className="space-y-2">
                      <Link href="/docs/integrations/jupyter" className="block text-blue-600 hover:underline text-sm">
                        → Jupyter Notebooks
                      </Link>
                      <Link href="/docs/integrations/aws-sagemaker" className="block text-blue-600 hover:underline text-sm">
                        → AWS SageMaker
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}