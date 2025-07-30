import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'
import { ExternalLink, BookOpen, Code, Zap } from 'lucide-react'

export default function DocsPage() {
  const quickStartSteps = [
    {
      title: "Get API Key",
      description: "Sign up and get your API key from the dashboard",
      code: `# Set your API key
export SCHLEP_API_KEY="your-api-key-here"`
    },
    {
      title: "Install SDK",
      description: "Install our Python SDK for easy integration",
      code: `# Install via pip
pip install schlep-engine

# Or use curl directly
curl -X POST https://api.schlep-engine.com/v1/transform`
    },
    {
      title: "Transform Data",
      description: "Upload and transform your first dataset",
      code: `import schlep_engine

# Transform CSV to TensorFlow format
result = schlep_engine.transform(
    file_path="data.csv",
    output_format="tensorflow",
    quality_threshold=0.95
)

print(f"Download URL: {result.download_url}")`
    }
  ]

  const resources = [
    {
      icon: BookOpen,
      title: "API Reference",
      description: "Complete API documentation with examples",
      link: "/docs/api-reference",
      external: false
    },
    {
      icon: Code,
      title: "SDKs & Libraries",
      description: "Python, JavaScript, and Go SDKs",
      link: "/docs/sdks/python",
      external: false
    },
    {
      icon: Zap,
      title: "Integration Guides",
      description: "Connect with popular ML platforms",
      link: "/docs/integrations/jupyter",
      external: false
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Documentation
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Everything you need to integrate schlep-engine into your ML pipeline
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              {resources.map((resource, index) => {
                const Icon = resource.icon
                return (
                  <a
                    key={index}
                    href={resource.link}
                    className="bg-gray-50 rounded-lg p-8 hover:bg-gray-100 transition-colors duration-200 block"
                  >
                    <div className="w-12 h-12 bg-[#1A5799] bg-opacity-10 rounded-lg flex items-center justify-center mb-6">
                      <Icon className="w-6 h-6 text-[#1A5799]" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                      {resource.title}
                      {resource.external && <ExternalLink className="w-4 h-4 ml-2" />}
                    </h3>
                    <p className="text-gray-600">
                      {resource.description}
                    </p>
                  </a>
                )
              })}
            </div>

            <div className="bg-gray-50 rounded-lg p-8 mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Quick Start Guide
              </h2>
              <div className="space-y-8">
                {quickStartSteps.map((step, index) => (
                  <div key={index} className="flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-1/3">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-[#1A5799] text-white rounded-full flex items-center justify-center mr-3 text-sm font-semibold">
                          {index + 1}
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-gray-600">
                        {step.description}
                      </p>
                    </div>
                    <div className="lg:w-2/3">
                      <div className="bg-gray-900 rounded-lg p-6">
                        <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                          {step.code}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Need Help?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Our team is here to help you get started with schlep-engine
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/docs/api-reference"
                  className="bg-[#1A5799] text-white px-8 py-3 rounded-lg hover:bg-[#1e3a8a] transition-colors duration-200 font-medium"
                >
                  View Full API Docs
                </a>
                <a
                  href="#contact"
                  className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}