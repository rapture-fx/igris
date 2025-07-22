import Link from 'next/link'
import { ArrowRightIcon, ClockIcon, CpuChipIcon, ShieldCheckIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function Introduction() {
  return (
    <div className="max-w-4xl mx-auto px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Introduction to Schlep Engine
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          The AI data preparation platform that eliminates the 80% of time data scientists 
          waste on data cleaning, so they can focus on building models that drive business value.
        </p>
        <div className="flex gap-4">
          <Link
            href="/introduction/quickstart"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quick Start
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/api-reference"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View API Reference
          </Link>
        </div>
      </div>

      {/* What is Schlep Engine */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">What is Schlep Engine?</h2>
        <p className="text-gray-600 mb-6">
          Schlep Engine is an AI-powered data processing API that automatically transforms raw, messy datasets 
          into ML-ready formats through intelligent pattern recognition and automated preprocessing workflows. 
          Our platform handles the tedious, time-consuming work of data preparation so your team can focus 
          on extracting insights and building models.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Core Problem We Solve</h3>
          <p className="text-blue-800">
            Data scientists spend 80% of their time on data cleaning and preparation, leaving only 20% 
            for actual model building and analysis. Schlep Engine flips this ratio by automating the 
            data preparation pipeline with AI-powered intelligence.
          </p>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Key Benefits</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">
                Reduce data prep time from weeks to hours with AI-powered automation that learns 
                and adapts to your data patterns.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <CpuChipIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Driven Accuracy</h3>
              <p className="text-gray-600">
                Advanced ML algorithms catch data quality issues and anomalies that human 
                reviewers typically miss.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise Scale</h3>
              <p className="text-gray-600">
                Handle datasets from gigabytes to petabytes with cloud-native architecture 
                designed for massive scale.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Learning System</h3>
              <p className="text-gray-600">
                Gets smarter with each dataset processed, building institutional knowledge 
                and improving over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">How It Works</h2>
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Your Data</h3>
              <p className="text-gray-600">
                Support for CSV, JSON, Excel, databases, and API connections. Upload files or connect directly to your data sources.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Profiling & Analysis</h3>
              <p className="text-gray-600">
                Our AI automatically detects data types, identifies quality issues, discovers patterns, and generates comprehensive data profiles.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Intelligent Transformation</h3>
              <p className="text-gray-600">
                AI-suggested cleaning rules, automated handling of missing values, pattern-based normalization, and schema validation.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Export to Your Framework</h3>
              <p className="text-gray-600">
                Direct export to TensorFlow, PyTorch, scikit-learn, or any format you need. Automated train/validation/test splits included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">ML Model Training</h3>
            <p className="text-gray-600 text-sm">
              Clean and prepare training datasets for machine learning models with automated feature engineering.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Data Quality Monitoring</h3>
            <p className="text-gray-600 text-sm">
              Real-time monitoring and alerting for data quality issues in production pipelines.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">ETL Pipeline Enhancement</h3>
            <p className="text-gray-600 text-sm">
              Add intelligent preprocessing steps to existing ETL pipelines with minimal code changes.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Multi-source Harmonization</h3>
            <p className="text-gray-600 text-sm">
              Combine and normalize data from multiple sources with automatic schema alignment.
            </p>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to Get Started?</h2>
        <p className="text-gray-600 mb-4">
          Follow our quick start guide to make your first API call in under 5 minutes.
        </p>
        <div className="flex gap-4">
          <Link
            href="/introduction/quickstart"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quick Start Guide
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/introduction/api-keys"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Get API Keys
          </Link>
        </div>
      </section>
    </div>
  )
}