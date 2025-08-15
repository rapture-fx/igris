import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import Link from 'next/link'
import { Package, ArrowRight, Beaker, Cloud, Terminal } from 'lucide-react'

export default function IntegrationsPage() {
  const integrations = [
    {
      name: "Jupyter Notebooks",
      description: "Interactive data processing with widgets, visualizations, and seamless pandas integration.",
      href: "/docs/integrations/jupyter",
      icon: Beaker,
      category: "Development",
      features: ["Interactive widgets", "Progress visualization", "Pandas integration", "Real-time debugging"],
      complexity: "Beginner"
    },
    {
      name: "AWS SageMaker",
      description: "Deploy and scale your data processing pipelines on AWS with SageMaker Processing Jobs and endpoints.",
      href: "/docs/integrations/aws-sagemaker",
      icon: Cloud,
      category: "Cloud Platform",
      features: ["Processing Jobs", "Model training", "Auto-scaling endpoints", "Batch inference"],
      complexity: "Advanced"
    }
  ]

  const comingSoon = [
    {
      name: "Apache Airflow",
      description: "Orchestrate data processing workflows with Airflow operators and sensors.",
      category: "Workflow",
      icon: Terminal
    },
    {
      name: "Google Colab",
      description: "Enhanced Jupyter integration with Google Colab's collaborative features.",
      category: "Development",
      icon: Beaker
    },
    {
      name: "Databricks",
      description: "Integrate with Databricks notebooks and MLflow for end-to-end ML workflows.",
      category: "Platform",
      icon: Package
    },
    {
      name: "Docker",
      description: "Containerized processing with pre-built Docker images and Kubernetes support.",
      category: "Infrastructure",
      icon: Package
    }
  ]

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Beginner': return 'bg-green-100 text-green-800'
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'Advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">
                  Integrations
                </h1>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Connect schlep-engine with your favorite tools and platforms for seamless data processing workflows.
                </p>
              </div>

              <div className="mb-16">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Available Integrations</h2>
                <div className="space-y-8">
                  {integrations.map((integration, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-8 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <integration.icon className="h-8 w-8 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-900">{integration.name}</h3>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {integration.category}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(integration.complexity)}`}>
                                {integration.complexity}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-4">{integration.description}</p>
                          </div>
                        </div>
                        <Link
                          href={integration.href}
                          className="inline-flex items-center gap-2 bg-[#1A5799] text-white px-4 py-2 rounded-lg hover:bg-[#1e3a8a] transition-colors flex-shrink-0"
                        >
                          View Guide
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Features</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {integration.features.map((feature, featureIndex) => (
                            <div key={featureIndex} className="flex items-center text-sm text-gray-600">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                              {feature}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-16">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Coming Soon</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {comingSoon.map((integration, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <integration.icon className="h-6 w-6 text-gray-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {integration.category}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm">{integration.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-8">
                <div className="text-center">
                  <Package className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Need a Custom Integration?
                  </h2>
                  <p className="text-gray-600 mb-6">
                    We're always looking to expand our integration ecosystem. Let us know what platforms you'd like to see supported.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Request Integration
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/docs/api-reference"
                      className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Build Custom Integration
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-16">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                  Integration Categories
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center p-6">
                    <Beaker className="mx-auto h-8 w-8 text-blue-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Development Tools</h3>
                    <p className="text-gray-600 text-sm">
                      Jupyter, Colab, IDEs, and other development environments for interactive data processing.
                    </p>
                  </div>
                  <div className="text-center p-6">
                    <Cloud className="mx-auto h-8 w-8 text-green-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cloud Platforms</h3>
                    <p className="text-gray-600 text-sm">
                      AWS, GCP, Azure, and other cloud services for scalable data processing and ML workflows.
                    </p>
                  </div>
                  <div className="text-center p-6">
                    <Terminal className="mx-auto h-8 w-8 text-purple-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Workflow Tools</h3>
                    <p className="text-gray-600 text-sm">
                      Airflow, Prefect, and other orchestration tools for automating data processing pipelines.
                    </p>
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