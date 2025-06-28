'use client'

import Link from 'next/link'
import { ArrowRight, Database, Brain, Workflow, BarChart3, Shield, Zap, CheckCircle, Github, Star, Sparkles, Target, Users, TrendingUp, Clock } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import MercuryNavigation from '@/components/layout/MercuryNavigation'
import { Footer } from '@/components/layout/Footer'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { 
  DocumentTextIcon, 
  CpuChipIcon, 
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  CloudIcon,
  BoltIcon 
} from '@heroicons/react/24/outline'

// Floating company logos component
const FloatingLogos = memo(function FloatingLogos() {
  const companies = [
    'Microsoft', 'Google', 'Amazon', 'Meta', 'Netflix', 'Spotify', 'Airbnb', 'Uber'
  ]

  return (
    <div className="relative overflow-hidden py-6">
      <div className="flex animate-scroll justify-center">
        {[...companies, ...companies].map((company, index) => (
          <div
            key={`${company}-${index}`}
            className="flex-shrink-0 mx-6 text-gray-400 font-medium text-base whitespace-nowrap"
          >
            {company}
          </div>
        ))}
      </div>
    </div>
  )
})

// Hero section
const HeroSection = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="flex items-center py-32 sm:py-40 lg:py-48 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          The Data <span className="text-blue-600">Schlep Handler</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Stop wasting 80% of your time on data prep. We handle the schlep so you don't have to.
        </p>
        <p className="mt-4 text-base text-gray-500">
          Throw us your worst CSV files, broken JSON, or whatever data nightmare you're dealing with. 
          We'll clean it, validate it, and give you something actually useful.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Start Handling Schlep
          </Link>
          <Link href="/documentation" className="text-sm font-semibold leading-6 text-gray-900">
            See how it works <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// Product showcase section
const ProductShowcase = () => {
  const products = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Smart Data Recognition",
      description: "AI models trained to automatically identify data types, patterns, and quality issues in your datasets.",
      gradient: "from-purple-500 to-purple-600"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Anomaly Detection",
      description: "Advanced algorithms flag data inconsistencies, outliers, and quality issues before they break your models.",
      gradient: "from-red-500 to-red-600"
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: "Auto Transformations",
      description: "Intelligent suggestions for data cleaning, normalization, and formatting based on your target AI framework.",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Pattern-Based Labeling",
      description: "Automatically label data based on recognized patterns, reducing manual annotation time by 90%.",
      gradient: "from-mercury-accent to-mercury-primary"
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "AI-Ready Output",
      description: "Export clean, structured data compatible with TensorFlow, PyTorch, scikit-learn, and other ML frameworks.",
      gradient: "from-cyan-500 to-cyan-600"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Quality Metrics",
      description: "Real-time data quality scores and recommendations to ensure your AI models train on the best possible data.",
      gradient: "from-orange-500 to-orange-600"
    }
  ]

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 font-apple">
            From messy data to AI-ready datasets
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto font-apple">
            Our AI-powered platform handles the data janitor work so you can focus on building amazing AI solutions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 bg-gradient-to-r ${product.gradient} rounded-lg flex items-center justify-center text-white mb-4`}>
                {product.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 font-apple">{product.title}</h3>
              <p className="text-sm text-gray-600 font-apple">{product.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Customer stories section
const CustomerStories = () => {
  const stories = [
    {
      company: "TechCorp",
      logo: "TC",
      quote: "Pollarbase cut our data prep time from weeks to hours. Our AI models are now training on clean, reliable data.",
      author: "Sarah Chen",
      role: "Head of AI"
    },
    {
      company: "DataFlow", 
      logo: "DF",
      quote: "We were spending 80% of our time cleaning data. Now we spend 80% of our time building better AI models.",
      author: "Mike Rodriguez",
      role: "ML Engineer"
    },
    {
      company: "StartupXYZ",
      logo: "SX", 
      quote: "Finally, a solution that understands the pain of data preparation. Our AI initiatives are no longer blocked.",
      author: "Emily Johnson",
      role: "CTO"
    }
  ]

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 font-apple">
            What our customers say
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto font-apple">
            Join thousands of AI teams who've eliminated data preparation bottlenecks.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {stories.map((story, index) => (
            <div key={index} className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-mercury-accent to-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm mr-3">
                  {story.logo}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 font-apple">{story.company}</h4>
                </div>
              </div>
              <p className="text-gray-600 mb-4 italic font-apple">"{story.quote}"</p>
              <div className="text-sm">
                <p className="font-semibold text-gray-900 font-apple">{story.author}</p>
                <p className="text-gray-500 font-apple">{story.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Market section
const MarketSection = () => {
  const marketPoints = [
    {
      icon: <Users className="w-8 h-8" />,
      title: "80% Time Savings",
      description: "Teams report spending 80% less time on data preparation tasks.",
      stats: "Average 32 hours → 6 hours per dataset"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "3x Faster AI Deployment",
      description: "Get your AI models into production 3x faster with clean, ready-to-use data.",
      stats: "3 months → 3 weeks to production"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Real-time Processing",
      description: "Process and clean datasets in real-time as new data arrives.",
      stats: "Process 1M+ records per minute"
    }
  ]

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 font-apple">
            The impact on your AI initiatives
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto font-apple">
            Don't let data preparation be the bottleneck that slows down your AI ambitions.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {marketPoints.map((point, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-mercury-accent to-blue-500 rounded-lg flex items-center justify-center text-white mx-auto mb-4">
                {point.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 font-apple">{point.title}</h3>
              <p className="text-gray-600 mb-3 font-apple">{point.description}</p>
              <p className="text-mercury-primary font-semibold text-sm font-apple">{point.stats}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Final CTA section
const FinalCTA = () => {
  return (
    <section className="py-16 bg-gray-900 text-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-semibold mb-4 font-apple">
          Ready to eliminate data preparation bottlenecks?
        </h2>
        <p className="text-lg text-gray-300 mb-8 font-apple">
          Join thousands of AI teams who've already made the switch to automated, intelligent data preparation.
        </p>
        <Link 
          href="/dashboard"
          className="px-8 py-4 bg-mercury-accent hover:bg-mercury-primary text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg inline-flex items-center gap-2 font-apple"
        >
          Start optimizing your data
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="px-6 lg:px-8">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-gray-900">Pollarbase</span>
            </Link>
          </div>
          <div className="flex lg:flex-1 lg:justify-end">
            <Link href="/auth/signin" className="text-sm font-semibold leading-6 text-gray-900">
              Log in <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </nav>
      </header>

      <MercuryNavigation />
      <HeroSection />
      <ProductShowcase />
      <CustomerStories />
      <MarketSection />
      <FinalCTA />
      <Footer />
    </div>
  )
}
