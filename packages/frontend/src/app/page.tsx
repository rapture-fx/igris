'use client'

import Link from 'next/link'
import { ArrowRight, Database, Brain, Workflow, BarChart3, Shield, Zap, CheckCircle, Github, Star, Sparkles, Target, Users, TrendingUp, Clock } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { Navigation } from '@/components/layout/Navigation'
import { Footer } from '@/components/layout/Footer'

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
                <p className="text-sm md:text-base font-medium mb-4 bg-gradient-to-r from-emerald-500 to-black bg-clip-text text-transparent tracking-wide font-apple">
          No more data schlep.
        </p>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 mb-8 tracking-tight font-apple">
            Instanly Transform{' '}
            <span className="text-emerald-500">Messy Data</span>
            <br />
            Into AI-Ready Data Sets.
          </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed font-apple">
         Our solution takes your raw, chaotic data and swiftly converts it into Al-optimized formats. Your Al models can start delivering value in moments, not months.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                      <Link 
              href="/dashboard" 
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg inline-flex items-center gap-2 font-apple"
            >
              Optimize your data now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="#demo" 
              className="px-8 py-4 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-colors inline-flex items-center gap-2 font-apple"
            >
              View demo
            </Link>
        </div>

        {/* Company Logos */}
        <div className="flex justify-center">
          <div className="text-sm text-gray-500 mb-8 font-apple">Trusted by AI teams at</div>
        </div>
        <div className="relative overflow-hidden">
          <div className="flex animate-scroll-loop items-center gap-8 opacity-60">
            {/* First set of companies */}
            {['Microsoft', 'Google', 'Amazon', 'Meta', 'Netflix', 'Spotify', 'Airbnb', 'Uber', 'Tesla', 'OpenAI', 'Anthropic', 'DeepMind', 'NVIDIA', 'Databricks', 'Snowflake', 'Palantir'].map((company, index) => (
              <div 
                key={`first-${company}`} 
                className="text-gray-400 font-semibold text-lg whitespace-nowrap flex-shrink-0 font-apple"
              >
                {company}
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {['Microsoft', 'Google', 'Amazon', 'Meta', 'Netflix', 'Spotify', 'Airbnb', 'Uber', 'Tesla', 'OpenAI', 'Anthropic', 'DeepMind', 'NVIDIA', 'Databricks', 'Snowflake', 'Palantir'].map((company, index) => (
              <div 
                key={`second-${company}`} 
                className="text-gray-400 font-semibold text-lg whitespace-nowrap flex-shrink-0 font-apple"
              >
                {company}
              </div>
            ))}
          </div>
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
      gradient: "from-emerald-500 to-emerald-600"
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
            AI teams love Pollarbase
          </h2>
          <p className="text-lg text-gray-600 font-apple">
            See how companies are accelerating their AI initiatives
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {stories.map((story, index) => (
            <div key={index} className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm mr-3">
                  {story.logo}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 font-apple">{story.company}</h4>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4 italic font-apple">"{story.quote}"</p>
              <div className="text-xs text-gray-500 font-apple">
                <span className="font-medium">{story.author}</span> · {story.role}
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
      title: "Target Market",
      description: "Any company implementing custom AI solutions but struggling with data quality and preparation.",
      stats: "85% of AI projects fail due to poor data quality"
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Unfair Advantage",
      description: "Proprietary algorithms for data cleaning with network effects as users contribute to schlep patterns.",
      stats: "10x faster than manual data cleaning"
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "High Value Solution",
      description: "Unblocks major AI initiatives by solving the biggest bottleneck in machine learning projects.",
      stats: "90% reduction in data prep time"
    }
  ]

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 font-apple">
            Built for the AI-first world
          </h2>
          <p className="text-lg text-gray-600 font-apple">
            Addressing the biggest pain point in AI development
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {marketPoints.map((point, index) => (
            <div key={index} className="bg-white p-6 rounded-lg text-center border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg flex items-center justify-center text-white mx-auto mb-4">
                {point.icon}
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 font-apple">{point.title}</h4>
              <p className="text-sm text-gray-600 mb-3 font-apple">{point.description}</p>
              <p className="text-emerald-600 font-semibold text-sm font-apple">{point.stats}</p>
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
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 font-apple">
          Ready to 10x your AI development speed?
        </h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto font-apple">
          Join thousands of AI teams who've eliminated data cleaning bottlenecks with Pollarbase. Start your free trial today.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            href="/dashboard" 
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg inline-flex items-center gap-2 font-apple"
          >
            Start free trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link 
            href="/pricing" 
            className="px-8 py-4 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-colors font-apple"
          >
            View pricing
          </Link>
        </div>
        
        <p className="text-sm text-gray-500 mt-4 font-apple">
          No credit card required • 14-day free trial • Cancel anytime
        </p>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-white">
        <HeroSection />
        <ProductShowcase />
        <CustomerStories />
        <MarketSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
