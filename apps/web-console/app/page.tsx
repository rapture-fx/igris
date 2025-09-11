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
      <div className={`relative overflow-hidden rounded-sm border bg-white px-6 py-2 shadow-md transition-all duration-300 hover:shadow-md dark:bg-gray-800`} style={{ borderColor: '#a0c0f0' }}>
        
        
        {/* Content */}
        <div className="relative z-10">
          {/* Icon and header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <div className={`w-6 h-6 flex items-center justify-center`} style={{ color: '#1f53d0' }}>
                  {icon}
                </div>
              </div>
              <h3 className="text-lg font-normal text-gray-900 dark:text-white my-0 font-mono">
                {title}
              </h3>
            </div>
            
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
        className="px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-md font-mono"
        style={{ backgroundColor: '#e9eef9', color: '#114dcd' }}
      >
        Dashboard
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
    <header className="dark:bg-gray-900 sticky top-0 z-50" style={{backgroundColor: '#f7f7f3'}}>
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and title */}
          <div className="flex items-center space-x-3">
            <div>
              <img src="/Docs Schlep-engne.svg" alt="Schlep-engine Logo" className="w-[52px] h-[52px]" />
            </div>
            <div>
              
              
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="http://localhost:3005" className="text-sm text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-mono">
              Docs
            </Link>
            <Link href="http://localhost:3000" className="text-sm text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-mono">
              Home
            </Link>
            <AuthButton />
          </nav>
        </div>
      </div>
    </header>
  )
}



export default function ConsolePage() {
  const [showWebhookTester, setShowWebhookTester] = useState(false)
  
  const industries = [
    {
      title: "AI",
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
      title: "Manufacture",
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
      title: "Fintech",
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
        

        

        {/* Industry Cards */}
        <div className="mb-16 pt-12">
          <h3 className="text-2xl font-normal mb-8 text-center font-mono" style={{ color: '#1f53d0' }}>
            Choose Your Industry
          </h3>
          <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
            {industries.map((industry, index) => (
              <IndustryCard key={index} {...industry} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-80">
          <h3 className="text-lg font-normal text-gray-900 dark:text-white mb-6 text-center font-mono">
            Essentials
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            
            
            <Link href="/security" className="flex items-center space-x-3 p-4 transition-colors">
              <Shield className="w-5 h-5" style={{ color: '#1f53d0' }} />
              <span className="text-sm font-normal text-gray-500 dark:text-gray-500 font-mono">Security Console</span>
            </Link>
            <Link href="/testing" className="flex items-center space-x-3 p-4 transition-colors">
              <TestTube className="w-5 h-5" style={{ color: '#1f53d0' }} />
              <span className="text-sm font-normal text-gray-500 dark:text-gray-500 font-mono">Test Collections</span>
            </Link>
            <button 
              onClick={() => setShowWebhookTester(true)}
              className="flex items-center space-x-3 p-4 transition-colors text-left"
            >
              <Webhook className="w-5 h-5" style={{ color: '#1f53d0' }} />
              <span className="text-sm font-normal text-gray-500 dark:text-gray-500 font-mono">Webhook Tester</span>
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