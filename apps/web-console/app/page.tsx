'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  Cpu, 
  Factory, 
  ShoppingCart, 
  Building2,
  Activity,
  ArrowRight,
  Terminal,
  Zap,
  Globe,
  BarChart3,
  User,
  LogOut,
  Webhook,
  Shield,
  TestTube
} from 'lucide-react'
import { useAuth } from '../src/lib/auth/context'
import LoginModal from '../src/components/auth/LoginModal'
import WebhookTester from '../src/components/console/WebhookTester'

interface IndustryCardProps {
  title: string
  description: string
  icon: React.ReactNode
  link: string
  apiCount: number
  features: string[]
  color: string
  bgGradient: string
}

const IndustryCard: React.FC<IndustryCardProps> = ({
  title,
  description,
  icon,
  link,
  apiCount,
  features,
  color,
  bgGradient
}) => {
  return (
    <Link href={link} className="group">
      <div className={`relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-${color}-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-${color}-500`}>
        {/* Background gradient */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${bgGradient}`}></div>
        
        {/* Content */}
        <div className="relative z-10">
          {/* Icon and header */}
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}>
              <div className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`}>
                {icon}
              </div>
            </div>
            <div className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700 dark:bg-${color}-900/20 dark:text-${color}-400`}>
              {apiCount} APIs
            </div>
          </div>

          {/* Title and description */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
            {description}
          </p>

          {/* Features */}
          <div className="space-y-2 mb-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 mr-2 flex-shrink-0`}></div>
                {feature}
              </div>
            ))}
          </div>

          {/* Action */}
          <div className={`flex items-center text-${color}-600 dark:text-${color}-400 font-medium group-hover:text-${color}-700 dark:group-hover:text-${color}-300 transition-colors`}>
            Explore APIs 
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  )
}

const AuthButton: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm">
          <User className="w-4 h-4" />
          <span>{user.name}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-1 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowLoginModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign in
      </button>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  )
}

const ConsoleHeader: React.FC = () => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and title */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Terminal className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Schlep-Engine API Console
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Industry-specific AI solutions at your fingertips
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="http://localhost:3003" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Documentation
            </Link>
            <Link href="http://localhost:3000" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Home
            </Link>
            <AuthButton />
          </nav>
        </div>
      </div>
    </header>
  )
}

const StatsSection: React.FC = () => {
  const stats = [
    { icon: <Zap className="w-5 h-5" />, label: "API Endpoints", value: "45+", color: "text-yellow-600" },
    { icon: <Globe className="w-5 h-5" />, label: "Industry Solutions", value: "4", color: "text-green-600" },
    { icon: <Activity className="w-5 h-5" />, label: "Response Time", value: "<100ms", color: "text-blue-600" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "Uptime", value: "99.9%", color: "text-purple-600" },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ConsolePage() {
  const [showWebhookTester, setShowWebhookTester] = useState(false)
  
  const industries = [
    {
      title: "AI Companies",
      description: "Model serving, automated retraining, and ML framework integrations for AI/ML teams",
      icon: <Cpu className="w-6 h-6" />,
      link: "/ai",
      apiCount: 15,
      features: [
        "Model Serving & Deployment",
        "Automated Retraining Pipelines", 
        "ML Framework Export",
        "Auto-Labeling & Active Learning"
      ],
      color: "purple",
      bgGradient: "bg-gradient-to-br from-purple-500 to-purple-600"
    },
    {
      title: "Manufacturing",
      description: "IoT monitoring, predictive maintenance, and supply chain optimization for smart factories",
      icon: <Factory className="w-6 h-6" />,
      link: "/manufacturing",
      apiCount: 12,
      features: [
        "Predictive Maintenance",
        "Quality Control AI",
        "IoT Dashboard & Analytics",
        "Supply Chain Optimization"
      ],
      color: "orange",
      bgGradient: "bg-gradient-to-br from-orange-500 to-orange-600"
    },
    {
      title: "E-commerce",
      description: "Recommendation engines, demand forecasting, and price optimization for online retailers",
      icon: <ShoppingCart className="w-6 h-6" />,
      link: "/ecommerce",
      apiCount: 10,
      features: [
        "Product Recommendations",
        "Demand Forecasting",
        "Dynamic Price Optimization",
        "Customer Segmentation"
      ],
      color: "green",
      bgGradient: "bg-gradient-to-br from-green-500 to-green-600"
    },
    {
      title: "Financial Services",
      description: "Fraud detection, credit scoring, and AML compliance for fintech and banking",
      icon: <Building2 className="w-6 h-6" />,
      link: "/financial",
      apiCount: 8,
      features: [
        "Real-time Fraud Detection",
        "Credit Risk Assessment", 
        "AML Compliance Screening",
        "Financial Analytics"
      ],
      color: "blue",
      bgGradient: "bg-gradient-to-br from-blue-500 to-blue-600"
    }
  ]

  return (
    <div className="min-h-screen dark:bg-gray-900" style={{backgroundColor: '#f7f7f3'}}>
      <ConsoleHeader />
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Interactive API Console
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-8">
            Test, explore, and integrate with Schlep-Engine&apos;s industry-specific AI solutions. 
            Real APIs, real results, production-ready endpoints.
          </p>
        </div>

        {/* Stats */}
        <StatsSection />

        {/* Industry Cards */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Choose Your Industry
          </h3>
          <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
            {industries.map((industry, index) => (
              <IndustryCard key={index} {...industry} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Link href="/playground" className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-white">API Playground</span>
            </Link>
            <Link href="http://localhost:3003" className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-gray-900 dark:text-white">Documentation</span>
            </Link>
            <Link href="/security" className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="font-medium text-gray-900 dark:text-white">Security Console</span>
            </Link>
            <Link href="/testing" className="flex items-center space-x-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
              <TestTube className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium text-gray-900 dark:text-white">Test Collections</span>
            </Link>
            <button 
              onClick={() => setShowWebhookTester(true)}
              className="flex items-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors w-full text-left"
            >
              <Webhook className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-gray-900 dark:text-white">Webhook Tester</span>
            </button>
          </div>
        </div>

        {/* Webhook Tester Modal */}
        <WebhookTester 
          isOpen={showWebhookTester}
          onClose={() => setShowWebhookTester(false)}
        />
      </main>
    </div>
  )
}