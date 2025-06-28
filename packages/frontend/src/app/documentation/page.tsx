'use client'

import { useState, memo } from 'react'
import { 
  ArrowRight, 
  Book, 
  Code, 
  Database, 
  Zap, 
  Shield, 
  Users, 
  CheckCircle, 
  Copy,
  Brain,
  Upload,
  BarChart3,
  Settings,
  Globe,
  Video,
  HelpCircle,
  Star,
  ChevronRight,
  Search,
  Menu,
  X,
  Home
} from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { tomorrow, github } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import MercuryNavigation from '@/components/layout/MercuryNavigation'
import { Footer } from '@/components/layout/Footer'

// Memoized components for better performance
const PollarbaseLogo = memo(function PollarbaseLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center">
      <div className="w-8 h-8 bg-gradient-mercury-accent rounded-lg flex items-center justify-center">
        <Brain className="w-5 h-5 text-white" />
      </div>
    </div>
  )
})

const PythonLogo = memo(function PythonLogo({ size = 24 }: { size?: number }) {
  return (
    <div className="w-6 h-6 bg-gradient-to-br from-mercury-accent to-yellow-400 rounded-lg flex items-center justify-center">
      <Code className="w-4 h-4 text-white" />
    </div>
  )
})

const JavaScriptLogo = memo(function JavaScriptLogo({ size = 24 }: { size?: number }) {
  return (
    <div className="w-6 h-6 bg-yellow-400 rounded-lg flex items-center justify-center">
      <Code className="w-4 h-4 text-black" />
    </div>
  )
})

interface CodeExample {
  language: string
  title: string
  description: string
  code: string
}

export default function DocumentationPage() {
  const [selectedSection, setSelectedSection] = useState('introduction')
  const [selectedLanguage, setSelectedLanguage] = useState('curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Documentation structure
  const docsSections = [
    {
      id: 'get-started',
      category: 'GET STARTED',
      items: [
        { id: 'introduction', label: 'Overview', icon: <Book className="w-4 h-4" /> },
        { id: 'quick-start', label: 'Quickstart', icon: <Zap className="w-4 h-4" /> },
        { id: 'authentication', label: 'Authentication', icon: <Shield className="w-4 h-4" /> },
        { id: 'playground', label: 'Playground', icon: <Video className="w-4 h-4" /> },
      ]
    },
    {
      id: 'capabilities',
      category: 'CAPABILITIES',
      items: [
        { id: 'data-upload', label: 'Data Upload', icon: <Upload className="w-4 h-4" /> },
        { id: 'analysis', label: 'AI Analysis', icon: <Brain className="w-4 h-4" /> },
        { id: 'cleaning', label: 'Data Cleaning', icon: <Zap className="w-4 h-4" /> },
        { id: 'ml-models', label: 'ML Models', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'export', label: 'Data Export', icon: <Database className="w-4 h-4" /> },
        { id: 'validation', label: 'Data Validation', icon: <CheckCircle className="w-4 h-4" /> },
      ]
    },
    {
      id: 'developer-guides',
      category: 'DEVELOPER GUIDES',
      items: [
        { id: 'python-guide', label: 'Python SDK', icon: <PythonLogo size={16} /> },
        { id: 'javascript-guide', label: 'JavaScript SDK', icon: <JavaScriptLogo size={16} /> },
        { id: 'rest-api', label: 'REST API', icon: <Globe className="w-4 h-4" /> },
        { id: 'webhooks', label: 'Webhooks', icon: <Settings className="w-4 h-4" /> },
        { id: 'examples', label: 'Code Examples', icon: <Code className="w-4 h-4" /> },
      ]
    },
    {
      id: 'best-practices',
      category: 'BEST PRACTICES',
      items: [
        { id: 'data-pipeline', label: 'Data Pipeline', icon: <Settings className="w-4 h-4" /> },
        { id: 'performance', label: 'Performance', icon: <Zap className="w-4 h-4" /> },
        { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
        { id: 'monitoring', label: 'Monitoring', icon: <BarChart3 className="w-4 h-4" /> },
      ]
    }
  ]

  // Code examples for different sections
  const codeExamples: Record<string, CodeExample[]> = {
    'quick-start': [
      {
        language: 'curl',
        title: 'Get API Key',
        description: 'Authenticate and retrieve your API key',
        code: `curl -X POST "https://api.pollarbase.com/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@company.com",
    "password": "your-secure-password"
  }'`
      },
      {
        language: 'curl',
        title: 'Upload Dataset',
        description: 'Upload a CSV file for analysis',
        code: `curl -X POST "https://api.pollarbase.com/v1/data/upload" \\
  -H "X-API-Key: sk-abc123..." \\
  -F "file=@dataset.csv" \\
  -F "auto_analyze=true"`
      }
    ],
    'python-guide': [
      {
        language: 'python',
        title: 'Python Quick Start',
        description: 'Complete workflow in Python',
        code: `import pollarbase
from pathlib import Path

# Initialize client
client = pollarbase.Client(api_key="sk-abc123...")

try:
    # Upload and analyze
    job = await client.upload_file(
        Path("data.csv"), 
        auto_analyze=True
    )
    
    # Get results
    results = await job.get_results()
    print(f"Quality Score: {results.quality_score}")
    print(f"Issues Found: {len(results.issues)}")
    
    # Apply cleaning suggestions
    cleaned_data = await job.apply_cleaning(
        remove_duplicates=True,
        fill_missing=True,
        fix_formats=True
    )
    
    # Export cleaned data
    await cleaned_data.export("cleaned_data.csv")
    
except pollarbase.APIError as e:
    print(f"Error: {e}")
`
      },
      {
        language: 'python',
        title: 'Advanced Analysis',
        description: 'Custom analysis with ML models',
        code: `# Advanced data analysis
analysis = await client.analyze_data(
    file_id="file_123",
    include_ml_insights=True,
    detect_anomalies=True,
    predict_quality=True
)

# Get ML predictions
predictions = analysis.ml_insights
print(f"Predicted Quality: {predictions.quality_score}")
print(f"Anomalies: {predictions.anomalies}")

# Custom transformations
transformations = [
    {"type": "normalize", "columns": ["age", "income"]},
    {"type": "encode", "columns": ["category"], "method": "onehot"},
    {"type": "impute", "columns": ["rating"], "strategy": "mean"}
]

result = await client.transform_data(
    file_id="file_123",
    transformations=transformations
)
`
      }
    ],
    'javascript-guide': [
      {
        language: 'javascript',
        title: 'JavaScript SDK',
        description: 'Using the JavaScript client',
        code: `import { PollarbaseClient } from '@pollarbase/js-sdk';

const client = new PollarbaseClient({
  apiKey: 'sk-abc123...',
      baseURL: 'https://api.pollarbase.com'
});

// Upload file
const uploadResult = await client.files.upload({
  file: fileInput.files[0],
  autoAnalyze: true,
  options: {
    detectDuplicates: true,
    validateFormats: true
  }
});

// Monitor progress
const job = await client.jobs.get(uploadResult.jobId);
console.log('Progress:', job.progress);

// Get analysis results
if (job.status === 'completed') {
  const analysis = await client.analysis.get(job.analysisId);
  console.log('Quality Score:', analysis.qualityScore);
  console.log('Issues:', analysis.issues);
}
`
      }
    ],
    'rest-api': [
      {
        language: 'curl',
        title: 'File Upload API',
        description: 'Upload and analyze files via REST API',
        code: `# Upload file
curl -X POST "https://api.pollarbase.com/v1/files/upload" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@data.csv" \\
  -F "options={\\\"autoAnalyze\\\": true}"

# Response
{
  "fileId": "file_123abc",
  "jobId": "job_456def", 
  "status": "processing",
  "estimatedTime": "2-5 minutes"
}`
      },
      {
        language: 'curl',
        title: 'Get Analysis Results',
        description: 'Retrieve analysis results',
        code: `# Get job status
curl -X GET "https://api.pollarbase.com/v1/jobs/job_456def" \\
  -H "Authorization: Bearer sk-abc123..."

# Response
{
  "jobId": "job_456def",
  "status": "completed",
  "progress": 100,
  "results": {
    "qualityScore": 0.87,
    "totalRows": 10000,
    "totalColumns": 15,
    "issues": [
      {
        "type": "missing_values",
        "column": "email", 
        "count": 23,
        "severity": "medium"
      }
    ]
  }
}`
      }
    ]
  }

  const handleCopyCode = (code: string, title: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(title)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const renderCodeExample = (example: CodeExample) => (
    <div key={example.title} className="mb-8">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{example.title}</h4>
        <p className="text-gray-600">{example.description}</p>
      </div>
      <div className="relative">
        <div className="absolute right-4 top-4 z-10">
          <button
            onClick={() => handleCopyCode(example.code, example.title)}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="Copy code"
          >
            {copiedCode === example.title ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
        <SyntaxHighlighter
          language={example.language}
          style={tomorrow}
          className="rounded-lg"
          customStyle={{
            padding: '1.5rem',
            paddingRight: '4rem',
            fontSize: '14px',
            lineHeight: '1.5'
          }}
        >
          {example.code}
        </SyntaxHighlighter>
      </div>
    </div>
  )

  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'introduction':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6">
                Pollarbase Documentation
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Welcome to Pollarbase - the AI-powered data intelligence platform 
                that transforms chaotic data into AI-ready formats in seconds.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Start</h3>
                <p className="text-gray-600 mb-6">
                  Get up and running in minutes with our simple upload, analyze, and export workflow.
                </p>
                <button
                  onClick={() => setSelectedSection('quick-start')}
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">API Reference</h3>
                <p className="text-gray-600 mb-6">
                  Comprehensive API documentation with examples in Python, JavaScript, and curl.
                </p>
                <button
                  onClick={() => setSelectedSection('rest-api')}
                  className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium"
                >
                  View API docs <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">AI-Powered Analysis</h4>
                    <p className="text-gray-600 text-sm">
                      Automated data profiling, quality assessment, and anomaly detection with 87-95% confidence scores.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Instant Cleaning</h4>
                    <p className="text-gray-600 text-sm">
                      Remove duplicates, handle missing values, detect outliers, and standardize formats automatically.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Enterprise Security</h4>
                    <p className="text-gray-600 text-sm">
                      SOC2 Type II compliant with end-to-end encryption, RBAC, and comprehensive audit logging.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'quick-start':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6">Quick Start Guide</h1>
              <p className="text-xl text-gray-600 mb-8">
                Get started with Pollarbase AI in just a few minutes. Follow these simple steps to upload, analyze, and clean your data.
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-2xl mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Prerequisites</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Valid email address for account creation</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Data files in CSV, JSON, Excel, or Parquet format</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">API key (get one from your dashboard)</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {codeExamples['quick-start']?.map(renderCodeExample)}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-yellow-600 font-bold text-sm">!</span>
                </div>
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-2">Rate Limits</h4>
                  <p className="text-yellow-700 text-sm">
                    Free tier: 10 uploads/month, 100MB max file size. 
                    Pro tier: Unlimited uploads, 10GB max file size.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'python-guide':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6 flex items-center">
                <PythonLogo size={40} />
                <span className="ml-4">Python SDK</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                The official Python SDK for Pollarbase AI. Install with pip and start analyzing data in minutes.
              </p>
            </div>

            <div className="bg-gray-900 text-gray-100 p-6 rounded-lg">
              <h4 className="text-green-400 font-semibold mb-2">Installation</h4>
              <SyntaxHighlighter language="bash" style={tomorrow} customStyle={{background: 'transparent', padding: 0}}>
                {`pip install pollarbase-ai`}
              </SyntaxHighlighter>
            </div>

            <div className="space-y-6">
              {codeExamples['python-guide']?.map(renderCodeExample)}
            </div>
          </div>
        )

      case 'javascript-guide':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6 flex items-center">
                <JavaScriptLogo size={40} />
                <span className="ml-4">JavaScript SDK</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Official JavaScript/TypeScript SDK for browser and Node.js environments.
              </p>
            </div>

            <div className="bg-gray-900 text-gray-100 p-6 rounded-lg">
              <h4 className="text-green-400 font-semibold mb-2">Installation</h4>
              <SyntaxHighlighter language="bash" style={tomorrow} customStyle={{background: 'transparent', padding: 0}}>
                {`npm install @pollarbase/js-sdk`}
              </SyntaxHighlighter>
            </div>

            <div className="space-y-6">
              {codeExamples['javascript-guide']?.map(renderCodeExample)}
            </div>
          </div>
        )

      case 'rest-api':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6 flex items-center">
                <Globe className="w-10 h-10 text-blue-600 mr-4" />
                REST API Reference
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Complete REST API reference with examples. Base URL: <code className="bg-gray-100 px-2 py-1 rounded">https://api.pollarbase.com/v1</code>
              </p>
            </div>

            <div className="space-y-6">
              {codeExamples['rest-api']?.map(renderCodeExample)}
            </div>

            <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Authentication</h4>
              <p className="text-blue-700 text-sm">
                Include your API key in the Authorization header: <code>Authorization: Bearer sk-your-key-here</code>
              </p>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-16">
            <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Section Coming Soon</h3>
            <p className="text-gray-600">This documentation section is being prepared.</p>
          </div>
        )
    }
  }

  const filteredSections = docsSections.map(section => ({
    ...section,
    items: section.items.filter(item => 
      searchQuery === '' || 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0)

  return (
    <div className="min-h-screen bg-white">
      <MercuryNavigation />
      
      {/* Documentation Header */}
      <header className="bg-mercury-primary text-white pt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <PollarbaseLogo size={32} />
              <div>
                <h1 className="text-3xl font-bold">Pollarbase Documentation</h1>
                <p className="text-mercury-text-light mt-2">Everything you need to integrate AI-powered data processing</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-6">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-mercury-surface/10 text-white placeholder-gray-300 rounded-lg border border-mercury-accent/30 focus:border-mercury-accent focus:outline-none w-64"
                />
              </div>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 bg-mercury-accent hover:bg-mercury-surface hover:text-mercury-primary rounded-lg font-medium transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to App
              </a>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex">
          {/* Sidebar */}
          <aside className={`w-64 flex-shrink-0 mr-8 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            <div className="sticky top-24">
              <nav className="space-y-8">
                {filteredSections.map((section) => (
                  <div key={section.id}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      {section.category}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedSection(item.id)
                            setMobileMenuOpen(false)
                          }}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedSection === item.id
                              ? 'bg-mercury-muted text-mercury-primary font-medium'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <span className={selectedSection === item.id ? 'text-mercury-accent' : 'text-gray-400'}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                          {selectedSection === item.id && (
                            <ChevronRight className="w-4 h-4 ml-auto text-mercury-accent" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="prose prose-lg max-w-none">
              {renderSectionContent()}
            </div>
          </main>
        </div>
      </div>
      
      <Footer />
    </div>
  )
} 