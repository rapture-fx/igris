'use client'

import { useState } from 'react'
import { ChevronRight, Zap, Database, BarChart3, Cloud, Globe, Code, Users, Megaphone } from 'lucide-react'
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
    <section className="py-20 bg-gray-50 dark:bg-black">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-6 text-left">
            Integrations Everywhere
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl text-left">
            Connect Schlep Engine with your favorite tools and platforms. 
            Build powerful data pipelines without the complexity.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-12">
          {/* Left Column: Category Tabs */}
          <div className="md:w-1/4">
            <div className="flex flex-col gap-4">
              {Object.entries(categories).map(([key, category]) => {
                const IconComponent = category.icon
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`flex items-center justify-start space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      activeCategory === key
                        ? 'bg-white text-gray-900 shadow-md dark:bg-gray-700 dark:text-white'
                        : 'bg-transparent text-gray-600 hover:bg-white dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-left">{category.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: Integration Grid */}
          <div className="md:w-3/4">
            <div className="flex flex-col gap-4">
              {categories[activeCategory as keyof typeof categories].integrations.map((integration, index) => (
                <div
                  key={index}
                  className="p-4 transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-4 mb-1">
                    <div className="text-xl">{integration.logo}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-[#468BE6] transition-colors">
                        {integration.name}
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{integration.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        

        

        {/* Popular Workflows */}
        <div className="mt-20">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-12">
            Popular Integration Workflows
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center space-x-3 mb-4">
                <BarChart3 className="w-5 h-5 text-[#1A5799]" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Analytics Pipeline</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Upload data from S3/Google Drive
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Clean & transform with Schlep Engine
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Push to Tableau/Power BI
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center space-x-3 mb-4">
                <Zap className="w-5 h-5 text-[#1A5799]" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Automated Workflow</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Zapier triggers on new data
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Process via API automatically
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Notify team via Slack
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center space-x-3 mb-4">
                <Database className="w-5 h-5 text-[#1A5799]" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Data Warehouse</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Extract from multiple sources
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Transform for consistency
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Load to Snowflake/BigQuery
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center space-x-3 mb-4">
                <Users className="w-5 h-5 text-[#1A5799]" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Customer Data Enrichment</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Import customer lists from CRM
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Clean & standardize contact info
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Append demographic/firmographic data
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center space-x-3 mb-4">
                <Megaphone className="w-5 h-5 text-[#1A5799]" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Marketing Campaign Optimization</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Collect campaign performance data
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Normalize and merge datasets
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full mr-2"></span>
                  Identify key segments for targeting
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}