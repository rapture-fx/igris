'use client'

import Link from 'next/link'
import { ArrowRight, Database, Brain, Workflow, BarChart3, Shield, Zap, CheckCircle, Github, Star, Sparkles, Target, Users, TrendingUp, Clock } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { 
  DocumentTextIcon, 
  CpuChipIcon, 
  ShieldCheckIcon,
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

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-6 pb-32 pt-16 sm:pt-20 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-2xl text-center">
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
      </div>

      {/* Problem Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Why Pollarbase?</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Because we're honest about what we do
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            We don't promise to "transform your business with AI." We promise to handle the boring, 
            frustrating data work so you can focus on the stuff that actually matters.
          </p>
        </div>
      </div>

      {/* Comparison */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 mt-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="bg-red-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-4">Other tools say:</h3>
            <ul className="space-y-2 text-red-700">
              <li>• "AI-powered intelligent data transformation platform"</li>
              <li>• "Revolutionize your data strategy"</li>
              <li>• "Next-generation analytics solution"</li>
            </ul>
            <p className="mt-4 text-sm text-red-600">
              <strong>Require:</strong> Data engineers, complex pipelines, months of setup
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">We say:</h3>
            <ul className="space-y-2 text-green-700">
              <li>• "We fix your broken data so you don't have to"</li>
              <li>• "Upload a file, wait a few minutes, get clean data"</li>
              <li>• "We handle the schlep"</li>
            </ul>
            <p className="mt-4 text-sm text-green-600">
              <strong>Require:</strong> Upload a file, wait a few minutes, get clean data
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Features That Actually Matter
          </h2>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            <div className="relative pl-16">
              <dt className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <DocumentTextIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Handles Broken Files
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                CSV with mixed encodings? JSON with invalid syntax? We'll fix it.
              </dd>
            </div>
            <div className="relative pl-16">
              <dt className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <BoltIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Real-time Processing
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                See your data get cleaned as it happens, no waiting around.
              </dd>
            </div>
            <div className="relative pl-16">
              <dt className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <CpuChipIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Simple APIs
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                RESTful endpoints that make sense, documentation that doesn't suck.
              </dd>
            </div>
            <div className="relative pl-16">
              <dt className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <ShieldCheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                No Vendor Lock-in
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                Export your data anytime, in any format. Your data is yours.
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 mt-24">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to stop dealing with data prep?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-blue-100">
              Upload your worst data nightmare and watch us turn it into something useful.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/dashboard"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started
              </Link>
              <Link href="/documentation" className="text-sm font-semibold leading-6 text-white">
                Learn more <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <p className="text-xs leading-5 text-gray-400">
              Pollarbase: We handle the schlep so you don't have to.
            </p>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-400">
              &copy; 2024 Pollarbase. Finally, a data platform that admits data work is often boring.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
