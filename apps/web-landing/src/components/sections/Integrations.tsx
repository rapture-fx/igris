'use client'

import { useState } from 'react'
import { ChevronRight, Zap, Database, BarChart3, Cloud, Globe, Code, Users, Megaphone } from 'lucide-react'
import Link from 'next/link'

export default function Integrations() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = {
    all: {
      title: 'All Integrations',
      icon: Zap,
      integrations: [
        { logo: '📊', name: 'Google Analytics', description: 'Track website traffic and user behavior.' },
        { logo: '📈', name: 'Mixpanel', description: 'Understand user actions and funnels.' },
        { logo: '📧', name: 'Mailchimp', description: 'Automate email marketing campaigns.' },
        { logo: '💬', name: 'Slack', description: 'Collaborate with your team in real-time.' },
        { logo: '💳', name: 'Stripe', description: 'Process online payments securely.' },
        { logo: '📦', name: 'Shopify', description: 'Manage your e-commerce store.' },
        { logo: '☁️', name: 'AWS S3', description: 'Store and retrieve data from the cloud.' },
        { logo: '📄', name: 'Google Sheets', description: 'Organize and analyze data in spreadsheets.' },
        { logo: '🚀', name: 'Salesforce', description: 'Manage customer relationships and sales processes.' },
        { logo: '💡', name: 'Zendesk', description: 'Provide customer support and service.' },
      ],
    },
    data: {
      title: 'Data & Analytics',
      icon: BarChart3,
      integrations: [
        { logo: '📊', name: 'Google Analytics', description: 'Track website traffic and user behavior.' },
        { logo: '📈', name: 'Mixpanel', description: 'Understand user actions and funnels.' },
        { logo: '☁️', name: 'AWS S3', description: 'Store and retrieve data from the cloud.' },
        { logo: '📄', name: 'Google Sheets', description: 'Organize and analyze data in spreadsheets.' },
      ],
    },
    marketing: {
      title: 'Marketing',
      icon: Megaphone,
      integrations: [
        { logo: '📧', name: 'Mailchimp', description: 'Automate email marketing campaigns.' },
        { logo: '🚀', name: 'Salesforce', description: 'Manage customer relationships and sales processes.' },
      ],
    },
    communication: {
      title: 'Communication',
      icon: Users,
      integrations: [
        { logo: '💬', name: 'Slack', description: 'Collaborate with your team in real-time.' },
        { logo: '💡', name: 'Zendesk', description: 'Provide customer support and service.' },
      ],
    },
    ecommerce: {
      title: 'E-commerce',
      icon: Globe,
      integrations: [
        { logo: '💳', name: 'Stripe', description: 'Process online payments securely.' },
        { logo: '📦', name: 'Shopify', description: 'Manage your e-commerce store.' },
      ],
    },
    development: {
      title: 'Development',
      icon: Code,
      integrations: [
        { logo: '🐙', name: 'GitHub', description: 'Host and manage your code.' },
        { logo: '⚙️', name: 'Jira', description: 'Track bugs and manage projects.' },
      ],
    },
  };
  

  

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
            <div className="bg-white rounded-xl p-6 dark:bg-gray-900">
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

            <div className="bg-white rounded-xl p-6 dark:bg-gray-900">
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

            <div className="bg-white rounded-xl p-6 dark:bg-gray-900">
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

            <div className="bg-white rounded-xl p-6 dark:bg-gray-900">
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

            <div className="bg-white rounded-xl p-6 dark:bg-gray-900">
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