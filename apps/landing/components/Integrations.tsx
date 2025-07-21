'use client'

import { useState } from 'react'
import { ChevronRight, Zap, Database, BarChart3, Cloud, Globe, Code } from 'lucide-react'
import Link from 'next/link'

export default function Integrations() {
  const [activeCategory, setActiveCategory] = useState('analytics')

  const categories = {
    analytics: {
      title: 'Analytics & BI',
      icon: BarChart3,
      integrations: [
        { name: 'Tableau', description: 'Direct data connector for visual analytics', logo: '📊' },
        { name: 'Power BI', description: 'Microsoft Power BI integration', logo: '📈' },
        { name: 'Looker', description: 'Google Cloud data platform', logo: '👁️' },
        { name: 'Grafana', description: 'Real-time monitoring dashboards', logo: '📉' },
        { name: 'Metabase', description: 'Open source business intelligence', logo: '🔍' },
        { name: 'Apache Superset', description: 'Modern data exploration platform', logo: '🚀' }
      ]
    },
    databases: {
      title: 'Databases & Storage',
      icon: Database,
      integrations: [
        { name: 'PostgreSQL', description: 'Direct database connections', logo: '🐘' },
        { name: 'MongoDB', description: 'NoSQL document database', logo: '🍃' },
        { name: 'Redis', description: 'In-memory data caching', logo: '🔴' },
        { name: 'Snowflake', description: 'Cloud data warehouse', logo: '❄️' },
        { name: 'BigQuery', description: 'Google Cloud analytics database', logo: '🔍' },
        { name: 'Amazon S3', description: 'Object storage integration', logo: '☁️' }
      ]
    },
    automation: {
      title: 'Automation & Workflows',
      icon: Zap,
      integrations: [
        { name: 'Zapier', description: 'Connect with 5000+ apps', logo: '⚡' },
        { name: 'Make (Integromat)', description: 'Visual automation platform', logo: '🔧' },
        { name: 'Apache Airflow', description: 'Workflow orchestration', logo: '🌊' },
        { name: 'GitHub Actions', description: 'CI/CD automation', logo: '🐱' },
        { name: 'Microsoft Power Automate', description: 'Business process automation', logo: '🔄' },
        { name: 'n8n', description: 'Open source workflow automation', logo: '🔗' }
      ]
    },
    cloud: {
      title: 'Cloud Platforms',
      icon: Cloud,
      integrations: [
        { name: 'AWS', description: 'Lambda, S3, EC2 integrations', logo: '🟧' },
        { name: 'Google Cloud', description: 'GCP services integration', logo: '🌈' },
        { name: 'Microsoft Azure', description: 'Azure Functions and Storage', logo: '🔷' },
        { name: 'Vercel', description: 'Edge functions deployment', logo: '▲' },
        { name: 'Netlify', description: 'Serverless function integration', logo: '🌊' },
        { name: 'Heroku', description: 'Platform as a service', logo: '💜' }
      ]
    },
    nocode: {
      title: 'No-Code Platforms',
      icon: Globe,
      integrations: [
        { name: 'Airtable', description: 'Spreadsheet-database hybrid', logo: '🏗️' },
        { name: 'Notion', description: 'All-in-one workspace', logo: '📝' },
        { name: 'Google Sheets', description: 'Cloud spreadsheet integration', logo: '📊' },
        { name: 'Bubble', description: 'Visual programming platform', logo: '💭' },
        { name: 'Webflow', description: 'Visual web development', logo: '🌐' },
        { name: 'Retool', description: 'Internal tool builder', logo: '🔨' }
      ]
    },
    development: {
      title: 'Developer Tools',
      icon: Code,
      integrations: [
        { name: 'GitHub', description: 'Version control integration', logo: '🐙' },
        { name: 'GitLab', description: 'DevOps platform integration', logo: '🦊' },
        { name: 'Docker', description: 'Container deployment', logo: '🐳' },
        { name: 'Kubernetes', description: 'Container orchestration', logo: '☸️' },
        { name: 'Jenkins', description: 'CI/CD automation', logo: '👨‍🔧' },
        { name: 'Slack', description: 'Team communication', logo: '💬' }
      ]
    }
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-6">
            <span className="text-[#468BE6]">Integrations</span> Everywhere
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Connect Schlep Engine with your favorite tools and platforms. 
            Build powerful data pipelines without the complexity.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {Object.entries(categories).map(([key, category]) => {
            const IconComponent = category.icon
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeCategory === key
                    ? 'bg-[#468BE6] text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <span>{category.title}</span>
              </button>
            )
          })}
        </div>

        {/* Integration Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {categories[activeCategory as keyof typeof categories].integrations.map((integration, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#468BE6]/30 hover:shadow-lg transition-all duration-200 group"
            >
              <div className="flex items-center space-x-4 mb-3">
                <div className="text-2xl">{integration.logo}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#468BE6] transition-colors">
                    {integration.name}
                  </h3>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#468BE6] transition-colors" />
              </div>
              <p className="text-sm text-gray-600">{integration.description}</p>
            </div>
          ))}
        </div>

        {/* Integration Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#468BE6] mb-2">500+</div>
            <div className="text-gray-600">Integrations</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#468BE6] mb-2">99.9%</div>
            <div className="text-gray-600">Uptime SLA</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#468BE6] mb-2">&lt;2s</div>
            <div className="text-gray-600">Avg Response</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#468BE6] mb-2">24/7</div>
            <div className="text-gray-600">Support</div>
          </div>
        </div>

        {/* Custom Integration CTA */}
        <div className="bg-gradient-to-r from-[#468BE6]/10 to-blue-100/50 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Need a Custom Integration?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Can't find the integration you need? Our team can build custom connectors for your specific tools and workflows. 
            Contact us to discuss your requirements.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/docs/integrations"
              className="bg-[#468BE6] text-white px-6 py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium"
            >
              View Integration Docs
            </Link>
            <Link
              href="/contact"
              className="border border-[#468BE6] text-[#468BE6] px-6 py-3 rounded-lg hover:bg-[#468BE6] hover:text-white transition-colors font-medium"
            >
              Request Custom Integration
            </Link>
          </div>
        </div>

        {/* Popular Workflows */}
        <div className="mt-20">
          <h3 className="text-2xl font-semibold text-gray-900 text-center mb-12">
            Popular Integration Workflows
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-[#468BE6]/10 p-2 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-[#468BE6]" />
                </div>
                <h4 className="font-semibold text-gray-900">Analytics Pipeline</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Upload data from S3/Google Drive
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Clean & transform with Schlep Engine
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Push to Tableau/Power BI
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-[#468BE6]/10 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-[#468BE6]" />
                </div>
                <h4 className="font-semibold text-gray-900">Automated Workflow</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Zapier triggers on new data
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Process via API automatically
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Notify team via Slack
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-[#468BE6]/10 p-2 rounded-lg">
                  <Database className="w-5 h-5 text-[#468BE6]" />
                </div>
                <h4 className="font-semibold text-gray-900">Data Warehouse</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Extract from multiple sources
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Transform for consistency
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-[#468BE6] rounded-full mr-2"></span>
                  Load to Snowflake/BigQuery
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}