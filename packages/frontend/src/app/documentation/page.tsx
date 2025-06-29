'use client'

import { useState } from 'react'
import { 
  ArrowRight, 
  Book, 
  Code, 
  Database, 
  Zap, 
  Shield, 
  Copy,
  Brain,
  Upload,
  BarChart3,
  Settings,
  Globe,
  Search,
  CheckCircle,
  AlertCircle,
  Key,
  Clock,
  Terminal,
  Sparkles,
  TrendingUp,
  Layers,
  Filter,
  Download,
  List,
  ExternalLink,
  HelpCircle,
  Activity
} from 'lucide-react'
import { Footer } from '@/components/layout/Footer'

interface CodeExample {
  language: string
  title: string
  description: string
  code: string
  response?: string
}

interface APIEndpoint {
  method: string
  path: string
  description: string
  parameters?: Array<{
    name: string
    type: string
    required: boolean
    description: string
  }>
}

export default function DocumentationPage() {
  const [selectedSection, setSelectedSection] = useState('introduction')
  const [selectedLanguage, setSelectedLanguage] = useState('curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Add scrollbar hiding styles
  const scrollbarHideStyles = `
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `

  // Documentation sections
  const docsSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      items: [
        { id: 'introduction', label: 'Introduction', icon: <Book className="w-4 h-4" /> },
        { id: 'quickstart', label: 'Quickstart', icon: <Zap className="w-4 h-4" /> },
        { id: 'authentication', label: 'Authentication', icon: <Shield className="w-4 h-4" /> },
        { id: 'errors', label: 'Error Handling', icon: <AlertCircle className="w-4 h-4" /> },
      ]
    },
    {
      id: 'core-concepts',
      title: 'Core Concepts',
      items: [
        { id: 'data-processing', label: 'Data Processing', icon: <Brain className="w-4 h-4" /> },
        { id: 'transformations', label: 'Transformations', icon: <Settings className="w-4 h-4" /> },
        { id: 'quality-scoring', label: 'Quality Scoring', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'anomaly-detection', label: 'Anomaly Detection', icon: <Filter className="w-4 h-4" /> },
        { id: 'data-formats', label: 'Supported Formats', icon: <Database className="w-4 h-4" /> },
        { id: 'performance-scaling', label: 'Performance & Scaling', icon: <Zap className="w-4 h-4" /> },
        { id: 'pipeline-architecture', label: 'Pipeline Architecture', icon: <Layers className="w-4 h-4" /> },
        { id: 'ml-integration', label: 'ML Framework Integration', icon: <Brain className="w-4 h-4" /> },
      ]
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      items: [
        { id: 'upload-api', label: 'Upload API', icon: <Upload className="w-4 h-4" /> },
        { id: 'analysis-api', label: 'Analysis API', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'transformation-api', label: 'Transformation API', icon: <Sparkles className="w-4 h-4" /> },
        { id: 'export-api', label: 'Export API', icon: <Download className="w-4 h-4" /> },
        { id: 'jobs-api', label: 'Jobs API', icon: <Clock className="w-4 h-4" /> },
        { id: 'pagination', label: 'Pagination', icon: <List className="w-4 h-4" /> },
        { id: 'filtering', label: 'Filtering & Search', icon: <Search className="w-4 h-4" /> },
      ]
    },
    {
      id: 'development',
      title: 'Development',
      items: [
        { id: 'rate-limits', label: 'Rate Limits', icon: <Clock className="w-4 h-4" /> },
        { id: 'testing', label: 'Testing', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'monitoring', label: 'Monitoring', icon: <Activity className="w-4 h-4" /> },
        { id: 'performance', label: 'Performance', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'troubleshooting', label: 'Troubleshooting', icon: <HelpCircle className="w-4 h-4" /> },
      ]
    },
    {
      id: 'production',
      title: 'Production & Enterprise',
      items: [
        { id: 'error-handling', label: 'Error Handling & Recovery', icon: <AlertCircle className="w-4 h-4" /> },
        { id: 'data-governance', label: 'Data Governance', icon: <Shield className="w-4 h-4" /> },
        { id: 'observability', label: 'Monitoring & Observability', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'cost-optimization', label: 'Cost Optimization', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'custom-validation', label: 'Custom Validation', icon: <CheckCircle className="w-4 h-4" /> },
      ]
    },
    {
      id: 'sdks-libraries',
      title: 'SDKs & Libraries',
      items: [
        { id: 'python-sdk', label: 'Python SDK', icon: <Code className="w-4 h-4" /> },
        { id: 'javascript-sdk', label: 'JavaScript SDK', icon: <Code className="w-4 h-4" /> },
        { id: 'rest-api', label: 'REST API', icon: <Globe className="w-4 h-4" /> },
        { id: 'webhooks', label: 'Webhooks', icon: <Settings className="w-4 h-4" /> },
      ]
    },
    {
      id: 'production',
      title: 'Production',
      items: [
        { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
        { id: 'best-practices', label: 'Best Practices', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'enterprise', label: 'Enterprise Features', icon: <Layers className="w-4 h-4" /> },
        { id: 'billing', label: 'Billing & Usage', icon: <Key className="w-4 h-4" /> },
      ]
    },
    {
      id: 'guides-tutorials',
      title: 'Guides & Tutorials',
      items: [
        { id: 'complete-pipeline', label: 'Complete Pipeline', icon: <Layers className="w-4 h-4" /> },
        { id: 'ml-integration', label: 'ML Integration', icon: <Brain className="w-4 h-4" /> },
        { id: 'changelog', label: 'Changelog', icon: <Activity className="w-4 h-4" /> },
      ]
    }
  ]

  // API endpoints
  const apiEndpoints: Record<string, APIEndpoint[]> = {
    'upload-api': [
      {
        method: 'POST',
        path: '/v1/data/upload',
        description: 'Upload a dataset for processing',
        parameters: [
          { name: 'file', type: 'file', required: true, description: 'CSV, JSON, or Parquet file' },
          { name: 'auto_analyze', type: 'boolean', required: false, description: 'Auto-run analysis' },
          { name: 'encoding', type: 'string', required: false, description: 'File encoding (utf-8, latin-1)' }
        ]
      },
      {
        method: 'GET',
        path: '/v1/data/datasets',
        description: 'List all uploaded datasets',
        parameters: [
          { name: 'limit', type: 'integer', required: false, description: 'Number of results (max 100)' },
          { name: 'offset', type: 'integer', required: false, description: 'Pagination offset' }
        ]
      }
    ],
    'analysis-api': [
      {
        method: 'POST',
        path: '/v1/analysis/analyze',
        description: 'Run AI analysis on a dataset',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'ID of uploaded dataset' },
          { name: 'include_ml_insights', type: 'boolean', required: false, description: 'Include ML predictions' },
          { name: 'detect_anomalies', type: 'boolean', required: false, description: 'Detect data anomalies' }
        ]
      },
      {
        method: 'GET',
        path: '/v1/analysis/{analysis_id}',
        description: 'Get analysis results',
        parameters: [
          { name: 'analysis_id', type: 'string', required: true, description: 'Analysis ID' }
        ]
      }
    ],
    'transformation-api': [
      {
        method: 'POST',
        path: '/v1/transform/apply',
        description: 'Apply transformations to a dataset',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'ID of dataset to transform' },
          { name: 'transformations', type: 'array', required: true, description: 'List of transformation rules' },
          { name: 'validate', type: 'boolean', required: false, description: 'Validate before applying' }
        ]
      }
    ],
    'export-api': [
      {
        method: 'POST',
        path: '/v1/export/download',
        description: 'Export processed data',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'ID of dataset to export' },
          { name: 'format', type: 'string', required: true, description: 'Output format (csv, json, parquet)' },
          { name: 'include_metadata', type: 'boolean', required: false, description: 'Include processing metadata' }
        ]
      }
    ],
    'jobs-api': [
      {
        method: 'GET',
        path: '/v1/jobs/{job_id}',
        description: 'Get job status and results',
        parameters: [
          { name: 'job_id', type: 'string', required: true, description: 'Job ID' }
        ]
      }
    ]
  }

    // Code examples
  const codeExamples: Record<string, CodeExample[]> = {
    quickstart: [
      {
        language: 'curl',
        title: 'Upload Your First Dataset',
        description: 'Get started by uploading a CSV file with automatic analysis',
        code: `curl -X POST "https://api.pollarbase.com/v1/data/upload" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@customer_data.csv" \\
  -F "auto_analyze=true" \\
  -F "quality_threshold=0.8"`,
        response: `{
  "dataset_id": "ds_7Qj2mK8fN3xB",
  "status": "processing", 
  "name": "customer_data.csv",
  "size_bytes": 524288,
  "rows": 10000,
  "columns": 12,
  "analysis_job_id": "job_3fD8kL1mP7nX",
  "estimated_completion": "2024-06-28T15:35:00Z"
}`
      },
      {
        language: 'python',
        title: 'Python Complete Workflow',
        description: 'End-to-end data processing with error handling',
        code: `import pollarbase
from pathlib import Path

# Initialize client with environment variable
client = pollarbase.Client()

try:
    # Upload and analyze dataset
    dataset = client.upload_file(
        Path("data/customer_data.csv"), 
        auto_analyze=True,
        quality_threshold=0.8
    )
    print(f"Dataset uploaded: {dataset.id}")
    
    # Wait for analysis with progress tracking
    analysis = dataset.wait_for_analysis(
        timeout=300,
        progress_callback=lambda p: print(f"Progress: {p}%")
    )
    
    print(f"Quality Score: {analysis.quality_score}/100")
    print(f"Issues Found: {len(analysis.issues)}")
    
    # Review and apply suggestions
    if analysis.quality_score < 90:
        suggestions = analysis.get_suggestions()
        for suggestion in suggestions:
            print(f"• {suggestion.description} (Impact: +{suggestion.impact}%)")
        
        # Apply high-impact transformations
        transformations = [s for s in suggestions if s.impact > 5]
        cleaned = dataset.apply_transformations(transformations)
        print(f"Applied {len(transformations)} transformations")
    else:
        cleaned = dataset
    
    # Export in multiple formats
    exports = cleaned.export_batch([
        {"format": "csv", "path": "clean_data.csv"},
        {"format": "parquet", "path": "clean_data.parquet"},
        {"format": "tensorflow", "split_ratio": 0.8}
    ])
    
    print("Export completed successfully!")
    for export in exports:
        print(f"  {export.format}: {export.path}")
        
except pollarbase.QualityError as e:
    print(f"Data quality too low: {e.score}/100")
    print("Suggestions:", e.suggestions)
except pollarbase.APIError as e:
    print(f"API Error: {e.message}")
except Exception as e:
    print(f"Unexpected error: {e}")`,
        response: `Dataset uploaded: ds_7Qj2mK8fN3xB
Progress: 25%
Progress: 50% 
Progress: 75%
Progress: 100%
Quality Score: 87/100
Issues Found: 4
• Remove 23 duplicate rows (Impact: +8%)
• Fill 156 missing values in 'age' column (Impact: +12%)  
• Standardize date formats in 'created_at' (Impact: +6%)
• Fix email format issues in 'email' column (Impact: +9%)
Applied 4 transformations
Export completed successfully!
  csv: clean_data.csv
  parquet: clean_data.parquet
  tensorflow: train.tfrecord, test.tfrecord`
      },
      {
        language: 'javascript',
        title: 'JavaScript Real-time Processing',
        description: 'Client-side processing with progress tracking and webhooks',
        code: `import Pollarbase from '@pollarbase/js';

const client = new Pollarbase({
  apiKey: process.env.POLLARBASE_API_KEY,
  webhook: 'https://myapp.com/webhooks/pollarbase'
});

class DataProcessor {
  async processFile(file) {
    try {
      // Setup progress tracking
      const progressBar = document.getElementById('progress');
      
      // Upload with real-time progress
      const dataset = await client.upload({
        file: file,
  autoAnalyze: true,
        onProgress: (progress) => {
          progressBar.style.width = progress + '%';
          console.log(\`Upload: \${progress}%\`);
        }
      });
      
      console.log(\`Dataset ID: \${dataset.id}\`);
      
      // Subscribe to analysis updates
      const subscription = client.subscribe(dataset.id, {
        onUpdate: (status) => this.handleAnalysisUpdate(status),
        onComplete: (analysis) => this.handleAnalysisComplete(analysis),
        onError: (error) => this.handleError(error)
      });
      
      return { dataset, subscription };
      
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  handleAnalysisUpdate(status) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = \`Processing: \${status.stage} (\${status.progress}%)\`;
  }
  
  async handleAnalysisComplete(analysis) {
    console.log(\`Quality Score: \${analysis.qualityScore}%\`);
    
    if (analysis.qualityScore < 85) {
      // Auto-apply high-confidence suggestions
      const autoSuggestions = analysis.suggestions.filter(s => 
        s.confidence > 0.9 && s.impact > 5
      );
      
      if (autoSuggestions.length > 0) {
        const cleaned = await analysis.applySuggestions(autoSuggestions);
        this.displayResults(cleaned);
      }
    } else {
      this.displayResults(analysis.dataset);
    }
  }
  
  handleError(error) {
    console.error('Processing failed:', error);
    const errorEl = document.getElementById('error');
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  }
  
  displayResults(dataset) {
    const resultsEl = document.getElementById('results');
    resultsEl.innerHTML = \`
      <h3>Processing Complete!</h3>
      <p>Dataset: \${dataset.name}</p>
      <p>Quality: \${dataset.qualityScore}%</p>
      <button onclick="downloadData('\${dataset.id}')">Download CSV</button>
      <button onclick="downloadData('\${dataset.id}', 'json')">Download JSON</button>
    \`;
  }
}

// Usage
const processor = new DataProcessor();
document.getElementById('fileInput').addEventListener('change', (e) => {
  processor.processFile(e.target.files[0]);
});`
      }
    ],
    authentication: [
      {
        language: 'curl',
        title: 'API Key Authentication',
        description: 'All API requests require authentication',
        code: `# Include your API key in the Authorization header
curl -H "Authorization: Bearer sk-abc123..." \\
  https://api.pollarbase.com/v1/data/datasets`,
        response: `{
  "datasets": [
    {
      "id": "ds_7Qj2mK8fN3xB",
      "name": "customer_data.csv",
      "created_at": "2024-06-28T10:30:00Z",
      "status": "processed"
    }
  ]
}`
      },
      {
        language: 'python',
        title: 'SDK Authentication',
        description: 'Set up authentication in Python SDK',
        code: `import pollarbase
import os

# Option 1: Direct API key
client = pollarbase.Client(api_key="sk-abc123...")

# Option 2: Environment variable (recommended)
os.environ['POLLARBASE_API_KEY'] = 'sk-abc123...'
client = pollarbase.Client()  # Auto-detects from env

# Option 3: Configuration file
client = pollarbase.Client.from_config('~/.pollarbase/config.json')`
      }
    ],
    'python-sdk': [
      {
        language: 'bash',
        title: 'Installation',
        description: 'Install the Python SDK',
        code: `# Install via pip
pip install pollarbase

# Or with conda
conda install -c pollarbase pollarbase

# Development version
pip install git+https://github.com/pollarbase/python-sdk.git`
      },
      {
        language: 'python',
        title: 'Complete Example',
        description: 'End-to-end data processing workflow',
        code: `import pollarbase
import pandas as pd
from pathlib import Path

# Initialize
client = pollarbase.Client()

# Upload multiple files
datasets = []
for file_path in Path("data/").glob("*.csv"):
    dataset = client.upload_file(file_path)
    datasets.append(dataset)

# Batch analysis
analyses = client.analyze_batch(datasets, 
    include_ml_insights=True,
    detect_anomalies=True
)

# Process results
for analysis in analyses:
    print(f"Dataset: {analysis.dataset.name}")
    print(f"Quality: {analysis.quality_score}%")
    
    if analysis.quality_score < 80:
        # Auto-fix low quality data
        cleaned = analysis.apply_auto_fixes()
        cleaned.export(f"cleaned_{analysis.dataset.name}")
    
    # Extract insights
    insights = analysis.ml_insights
    print(f"Predicted trends: {insights.trends}")
    print(f"Anomalies found: {len(insights.anomalies)}")
    print("---")`
      }
    ],
    errors: [
      {
        language: 'json',
        title: 'Error Response Format',
        description: 'All errors return a consistent JSON structure',
        code: `{
  "error": {
    "type": "validation_error",
    "code": "INVALID_FILE_FORMAT",
    "message": "Unsupported file format. Please upload CSV, JSON, or Parquet files.",
    "details": {
      "file_extension": ".xlsx",
      "supported_formats": ["csv", "json", "parquet"]
    },
    "request_id": "req_7Qj2mK8fN3xB"
  }
}`
      },
      {
        language: 'python',
        title: 'Error Handling in Python',
        description: 'Proper error handling with the Python SDK',
        code: `import pollarbase
from pollarbase.exceptions import (
    APIError, 
    AuthenticationError, 
    RateLimitError,
    ValidationError
)

client = pollarbase.Client()

try:
    dataset = client.upload_file("data.csv")
    analysis = dataset.analyze()
    
except AuthenticationError as e:
    print(f"Authentication failed: {e.message}")
    # Handle invalid API key
    
except ValidationError as e:
    print(f"Validation error: {e.message}")
    print(f"Invalid fields: {e.fields}")
    # Handle validation errors
    
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after} seconds")
    time.sleep(e.retry_after)
    # Implement exponential backoff
    
except APIError as e:
    print(f"API Error: {e.status_code} - {e.message}")
    if e.status_code >= 500:
        # Server error - retry logic
        pass
    else:
        # Client error - fix request
        pass`,
        response: `Authentication failed: Invalid API key provided
Rate limited. Retry after: 60 seconds
Validation error: File format not supported
Invalid fields: ['file_type', 'encoding']`
      }
    ]
  }

  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(title)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const renderHighlightedCode = (code: string, language: string) => {
    // Enhanced syntax highlighting without external libraries
    const lines = code.split('\n')
    return lines.map((line, index) => {
      let highlightedLine = line
      
      // Enhanced highlighting patterns with more colors
      if (language === 'bash' || language === 'curl') {
        highlightedLine = line
          .replace(/(curl|npm|pip|yarn|pnpm|cd|ls|mkdir|git|docker)/g, '<span class="text-cyan-400 font-semibold">$1</span>')
          .replace(/(-[A-Za-z]+|--[A-Za-z-]+)/g, '<span class="text-yellow-300">$1</span>')
          .replace(/(https?:\/\/[^\s]+)/g, '<span class="text-emerald-400">$1</span>')
          .replace(/(".*?"|'.*?')/g, '<span class="text-orange-300">$1</span>')
          .replace(/(\$[A-Za-z_][A-Za-z0-9_]*)/g, '<span class="text-violet-300">$1</span>')
          .replace(/(#.*)/g, '<span class="text-slate-500 italic">$1</span>')
      } else if (language === 'python') {
        highlightedLine = line
          .replace(/(import|from|def|class|if|else|elif|for|while|try|except|return|await|async|with|as|pass|break|continue)/g, '<span class="text-pink-400 font-semibold">$1</span>')
          .replace(/(print|len|str|int|list|dict|set|tuple|open|range|enumerate|zip)/g, '<span class="text-sky-400">$1</span>')
          .replace(/(".*?"|'.*?'|f".*?"|f'.*?')/g, '<span class="text-emerald-300">$1</span>')
          .replace(/(\d+\.?\d*)/g, '<span class="text-amber-300">$1</span>')
          .replace(/(True|False|None)/g, '<span class="text-violet-400">$1</span>')
          .replace(/(#.*)/g, '<span class="text-slate-500 italic">$1</span>')
          .replace(/(@\w+)/g, '<span class="text-rose-400">$1</span>')
      } else if (language === 'javascript') {
        highlightedLine = line
          .replace(/(const|let|var|function|async|await|import|export|if|else|for|while|try|catch|return|new|this|typeof|instanceof)/g, '<span class="text-pink-400 font-semibold">$1</span>')
          .replace(/(console|Array|Object|Promise|fetch|JSON|Math|Date|Error)/g, '<span class="text-sky-400">$1</span>')
          .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-emerald-300">$1</span>')
          .replace(/(\d+\.?\d*)/g, '<span class="text-amber-300">$1</span>')
          .replace(/(true|false|null|undefined)/g, '<span class="text-violet-400">$1</span>')
          .replace(/(\/\/.*)/g, '<span class="text-slate-500 italic">$1</span>')
          .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-slate-500 italic">$1</span>')
      } else if (language === 'json') {
        highlightedLine = line
          .replace(/(".*?"):/g, '<span class="text-cyan-400">$1</span>:')
          .replace(/: (".*?")/g, ': <span class="text-emerald-300">$1</span>')
          .replace(/: (\d+\.?\d*)/g, ': <span class="text-amber-300">$1</span>')
          .replace(/: (true|false|null)/g, ': <span class="text-violet-400">$1</span>')
          .replace(/([{}[\],])/g, '<span class="text-slate-300">$1</span>')
      }
      
      return (
        <span key={index} className="block leading-relaxed">
          <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />
        </span>
      )
    })
  }

  const renderCodeBlock = (example: CodeExample) => (
    <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-700 mb-4 shadow-md">
      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
          <Terminal className="w-3 h-3 text-slate-400" />
          <span className="text-xs font-medium text-slate-100">{example.title}</span>
          <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">{example.language}</span>
        </div>
        <button
          onClick={() => copyToClipboard(example.code, example.title)}
          className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800"
        >
          <Copy className="w-3 h-3" />
          <span className="text-xs">{copiedCode === example.title ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs text-slate-400 mb-3">{example.description}</p>
        <pre className="text-xs leading-relaxed overflow-x-hidden font-mono scrollbar-hide">
          <code className="text-slate-100" style={{ fontFamily: 'SF Mono, -apple-system, BlinkMacSystemFont, Monaco, Consolas, monospace' }}>
            {renderHighlightedCode(example.code, example.language)}
          </code>
        </pre>
        {example.response && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center space-x-1 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <p className="text-xs text-slate-400 font-medium">Response:</p>
            </div>
            <pre className="text-xs text-emerald-400 overflow-x-hidden leading-relaxed font-mono scrollbar-hide">
              <code style={{ fontFamily: 'SF Mono, -apple-system, BlinkMacSystemFont, Monaco, Consolas, monospace' }}>
                {example.response}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )

  const renderAPIEndpoint = (endpoint: APIEndpoint) => (
    <div className="mb-6 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${
              endpoint.method === 'GET' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
              endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
              endpoint.method === 'PUT' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
              'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {endpoint.method}
            </span>
            <code className="text-sm font-mono bg-gray-50 px-3 py-1.5 rounded-lg border font-semibold">
              {endpoint.path}
            </code>
          </div>
          <button 
            onClick={() => copyToClipboard(endpoint.path, 'API Path')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Copy API path"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-gray-700 mb-6 text-base leading-relaxed">{endpoint.description}</p>
        
        {endpoint.parameters && endpoint.parameters.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Parameters
            </h4>
            <div className="space-y-3">
              {endpoint.parameters.map((param) => (
                <div key={param.name} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <code className="font-mono bg-white px-3 py-1.5 rounded-md text-sm font-semibold border">
                      {param.name}
                    </code>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      param.required 
                        ? 'bg-red-100 text-red-700 border border-red-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {param.type} {param.required ? '• Required' : '• Optional'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed ml-1">
                    {param.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (selectedSection) {
      case 'introduction':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                Pollarbase API Documentation
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                The complete reference for Pollarbase's data processing API. 
                <strong> Handle the schlep so you don't have to.</strong>
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-4">
                <Sparkles className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-base font-bold text-blue-900 mb-2">What is Pollarbase?</h3>
                  <p className="text-blue-800 leading-relaxed text-sm">
                    Pollarbase is the <strong>Stripe for data</strong> - a comprehensive API platform that automatically 
                    identifies data types, detects anomalies, suggests transformations, and outputs 
                    ML-ready datasets. <strong>Spend 80% less time on data preparation.</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  <h3 className="text-base font-bold text-gray-900">Quick to Start</h3>
                </div>
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                  Upload your data and get insights in seconds. No complex setup required.
                </p>
                <button
                   onClick={() => setSelectedSection('quickstart')}
                   className="text-blue-600 hover:text-blue-700 font-semibold flex items-center text-sm">
                  Get started <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-bold text-gray-900">AI-Powered</h3>
                </div>
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                  Advanced ML models automatically detect patterns and suggest improvements.
                </p>
                <button
                   onClick={() => setSelectedSection('analysis-api')}
                   className="text-blue-600 hover:text-blue-700 font-semibold flex items-center text-sm">
                  Explore AI features <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-10">
              <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">Core Features</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Automatic Type Detection</h4>
                  <p className="text-gray-600">Smart identification of data types and formats</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-4" />
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Quality Scoring</h4>
                  <p className="text-gray-600">Comprehensive quality metrics and insights</p>
                </div>
                <div className="text-center">
                  <Sparkles className="w-8 h-8 text-purple-600 mx-auto mb-4" />
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Smart Transformations</h4>
                  <p className="text-gray-600">AI-suggested data cleaning and formatting</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'quickstart':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Quickstart Guide</h1>
              <p className="text-sm text-gray-600 mb-4">
                Get up and running with Pollarbase in under 5 minutes.
              </p>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <Key className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-yellow-900 mb-2">Get Your API Key</h3>
                  <p className="text-yellow-800 mb-3 text-sm">
                    First, sign up for a free account and get your API key from the dashboard.
                  </p>
                  <a href="/dashboard/api-keys" 
                     className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-semibold">
                    Get API Key <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Step 1: Choose Your Language</h2>
                <div className="flex space-x-3 mb-6">
                  {['curl', 'python', 'javascript'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        selectedLanguage === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
                
                {codeExamples.quickstart
                  ?.filter(example => example.language === selectedLanguage)
                  .map((example, index) => (
                    <div key={index}>
                      {renderCodeBlock(example)}
                    </div>
                  ))}
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-green-900 mb-3">Next Steps</h3>
                    <ul className="text-green-800 space-y-1 text-sm">
                      <li>• Explore the <button onClick={() => setSelectedSection('python-sdk')} className="font-semibold underline hover:text-green-900">Python SDK</button> for advanced features</li>
                      <li>• Learn about <button onClick={() => setSelectedSection('data-processing')} className="font-semibold underline hover:text-green-900">data processing concepts</button></li>
                      <li>• Check out <button onClick={() => setSelectedSection('complete-pipeline')} className="font-semibold underline hover:text-green-900">complete pipeline examples</button></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'authentication':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Authentication</h1>
              <p className="text-sm text-gray-600">
                Secure your API requests with proper authentication.
              </p>
            </div>

            <div className="space-y-8">
              {codeExamples.authentication?.map((example, index) => (
                <div key={index}>
                  {renderCodeBlock(example)}
                </div>
              ))}

              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-8">
                <div className="flex items-start space-x-4">
                  <Shield className="w-8 h-8 text-red-600 mt-1" />
                <div>
                    <h3 className="text-xl font-bold text-red-900 mb-4">Security Best Practices</h3>
                    <ul className="text-red-800 space-y-3 text-lg">
                      <li>• Never expose API keys in client-side code</li>
                      <li>• Use environment variables to store API keys</li>
                      <li>• Rotate your API keys regularly</li>
                      <li>• Use different keys for development and production</li>
                    </ul>
                </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'errors':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Error Handling</h1>
              <p className="text-base text-gray-600 mb-6">
                Understanding and handling errors in the Pollarbase API.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-3">HTTP Status Codes</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <code className="text-green-600">200</code>
                    <span className="text-gray-600">Success</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <code className="text-red-600">400</code>
                    <span className="text-gray-600">Bad Request</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <code className="text-red-600">401</code>
                    <span className="text-gray-600">Unauthorized</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <code className="text-red-600">429</code>
                    <span className="text-gray-600">Rate Limited</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <code className="text-red-600">500</code>
                    <span className="text-gray-600">Server Error</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Error Response Format</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
{`{
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "File format not supported",
    "details": {
      "supported_formats": ["csv", "json", "parquet"],
      "received_format": "xlsx"
    }
  }
}`}
                </pre>
              </div>
            </div>

            {renderCodeBlock({
              language: 'python',
              title: 'Error Handling with Python SDK',
              description: 'Proper error handling in your Python applications',
              code: `import pollarbase
from pollarbase.exceptions import (
    APIError, 
    AuthenticationError, 
    RateLimitError,
    ValidationError
)

client = pollarbase.Client()

try:
    dataset = client.upload_file("data.csv")
    analysis = dataset.analyze()
    
except AuthenticationError as e:
    print(f"Authentication failed: {e.message}")
    # Handle invalid API key
    
except ValidationError as e:
    print(f"Validation error: {e.message}")
    print(f"Invalid fields: {e.fields}")
    # Handle validation errors
    
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after} seconds")
    time.sleep(e.retry_after)
    # Implement exponential backoff
    
except APIError as e:
    print(f"API Error: {e.status_code} - {e.message}")
    if e.status_code >= 500:
        # Server error - retry logic
        pass
    else:
        # Client error - fix request
        pass`,
              response: `Authentication failed: Invalid API key provided
Rate limited. Retry after: 60 seconds
Validation error: File format not supported
Invalid fields: ['file_type', 'encoding']`
            })}
          </div>
        )

      case 'data-processing':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Data Processing</h1>
              <p className="text-base text-gray-600 mb-6">
                How Pollarbase processes and analyzes your data behind the scenes.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                <h3 className="text-base font-semibold text-blue-900 mb-3">Processing Pipeline</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 font-semibold text-xs">1</span>
                    </div>
                    <div className="font-medium text-blue-900">Upload</div>
                    <div className="text-blue-700 text-xs">File parsing & validation</div>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 font-semibold text-xs">2</span>
                    </div>
                    <div className="font-medium text-blue-900">Analyze</div>
                    <div className="text-blue-700 text-xs">Schema detection & profiling</div>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 font-semibold text-xs">3</span>
                    </div>
                    <div className="font-medium text-blue-900">Transform</div>
                    <div className="text-blue-700 text-xs">AI-powered cleaning</div>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 font-semibold text-xs">4</span>
                    </div>
                    <div className="font-medium text-blue-900">Export</div>
                    <div className="text-blue-700 text-xs">ML-ready output</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Data Types Detected</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Categorical variables</li>
                    <li>• Numerical (int, float)</li>
                    <li>• Dates & timestamps</li>
                    <li>• Text & free-form</li>
                    <li>• Boolean values</li>
                    <li>• Email addresses</li>
                    <li>• Phone numbers</li>
                    <li>• URLs</li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Quality Checks</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Missing value detection</li>
                    <li>• Duplicate identification</li>
                    <li>• Outlier analysis</li>
                    <li>• Format consistency</li>
                    <li>• Data distribution</li>
                    <li>• Correlation analysis</li>
                    <li>• Constraint validation</li>
                    <li>• Pattern matching</li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Insights</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Feature importance</li>
                    <li>• Relationship discovery</li>
                    <li>• Anomaly scoring</li>
                    <li>• Trend identification</li>
                    <li>• Seasonality detection</li>
                    <li>• Classification readiness</li>
                    <li>• Prediction targets</li>
                    <li>• Data drift alerts</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )

      case 'transformations':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Data Transformations</h1>
              <p className="text-base text-gray-600 mb-6">
                AI-powered transformations that clean and prepare your data automatically.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Automatic Transformations</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start space-x-3">
                      <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">✓</span>
                      <div>
                        <div className="font-medium text-gray-900">Remove Duplicates</div>
                        <div className="text-gray-600 text-xs">Exact and fuzzy duplicate detection</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">✓</span>
                      <div>
                        <div className="font-medium text-gray-900">Fill Missing Values</div>
                        <div className="text-gray-600 text-xs">Smart imputation strategies</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">✓</span>
                      <div>
                        <div className="font-medium text-gray-900">Standardize Formats</div>
                        <div className="text-gray-600 text-xs">Dates, phones, emails, addresses</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Manual Control</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start space-x-3">
                      <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">⚙</span>
                      <div>
                        <div className="font-medium text-gray-900">Custom Rules</div>
                        <div className="text-gray-600 text-xs">Define your own transformation logic</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">⚙</span>
                      <div>
                        <div className="font-medium text-gray-900">Review & Approve</div>
                        <div className="text-gray-600 text-xs">Preview changes before applying</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">⚙</span>
                      <div>
                        <div className="font-medium text-gray-900">Rollback Support</div>
                        <div className="text-gray-600 text-xs">Undo transformations if needed</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Advanced Transformation Pipeline',
                description: 'Chaining multiple transformations with custom rules',
                code: `import pollarbase

client = pollarbase.Client()
dataset = client.get_dataset("ds_abc123")

# Define transformation pipeline
pipeline = pollarbase.TransformationPipeline([
    # Remove exact duplicates
    pollarbase.RemoveDuplicates(method="exact"),
    
    # Smart missing value imputation
    pollarbase.FillMissing(
        strategy="smart",  # Uses ML to predict best values
        columns=["age", "income"],
        fallback="median"
    ),
    
    # Standardize date formats
    pollarbase.StandardizeDates(
        columns=["created_at", "updated_at"],
        format="ISO8601"
    ),
    
    # Custom transformation rule
    pollarbase.CustomRule(
        name="normalize_email",
        function=lambda x: x.lower().strip(),
        columns=["email"]
    ),
    
    # Feature engineering
    pollarbase.CreateFeatures([
        pollarbase.DateFeatures(["created_at"]),  # Extract day, month, year
        pollarbase.TextFeatures(["description"]),  # TF-IDF, sentiment
        pollarbase.NumericalFeatures(["price"])   # Log, normalize, bin
    ])
])

# Preview transformations (dry run)
preview = dataset.preview_transformations(pipeline)
print(f"Will affect {preview.rows_affected} rows")
print(f"Quality score improvement: +{preview.quality_improvement}%")

# Apply if satisfied
if preview.quality_improvement > 10:
    transformed = dataset.apply_transformations(pipeline)
    print(f"Transformation complete. New quality score: {transformed.quality_score}%")
else:
    print("Transformations did not meet quality threshold")`,
                response: `Will affect 2,847 rows
Quality score improvement: +23%
Transformation complete. New quality score: 91%`
              })}
            </div>
          </div>
        )

      case 'quality-scoring':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Quality Scoring</h1>
              <p className="text-base text-gray-600 mb-6">
                Understanding how Pollarbase calculates data quality scores and what they mean.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5">
                <h3 className="text-base font-semibold text-green-900 mb-3">Quality Score Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-700">35%</div>
                    <div className="text-sm font-medium text-green-900">Completeness</div>
                    <div className="text-xs text-green-700">Missing values</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-700">25%</div>
                    <div className="text-sm font-medium text-green-900">Validity</div>
                    <div className="text-xs text-green-700">Format compliance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-700">25%</div>
                    <div className="text-sm font-medium text-green-900">Uniqueness</div>
                    <div className="text-xs text-green-700">Duplicate detection</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-700">15%</div>
                    <div className="text-sm font-medium text-green-900">Consistency</div>
                    <div className="text-xs text-green-700">Cross-field validation</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Score Ranges</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>90-100%</span>
                      </span>
                      <span className="text-gray-600">Excellent</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>80-89%</span>
                      </span>
                      <span className="text-gray-600">Good</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span>70-79%</span>
                      </span>
                      <span className="text-gray-600">Fair</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span>Below 70%</span>
                      </span>
                      <span className="text-gray-600">Poor</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Improvement Actions</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600">+5-15%</span>
                      <span className="text-gray-600">Remove duplicates</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600">+10-25%</span>
                      <span className="text-gray-600">Fill missing values</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600">+5-20%</span>
                      <span className="text-gray-600">Fix format issues</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600">+3-10%</span>
                      <span className="text-gray-600">Validate constraints</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'javascript-sdk':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">JavaScript SDK</h1>
              <p className="text-base text-gray-600 mb-6">
                Client-side and Node.js SDK for integrating Pollarbase into JavaScript applications.
              </p>
            </div>

            <div className="space-y-6">
              {renderCodeBlock({
                language: 'bash',
                title: 'Installation',
                description: 'Install the JavaScript SDK via npm or yarn',
                code: `# Using npm
npm install @pollarbase/js

# Using yarn
yarn add @pollarbase/js

# Using CDN (browser)
<script src="https://cdn.pollarbase.com/js/v2.1.0/pollarbase.min.js"></script>`
              })}

              {renderCodeBlock({
                language: 'javascript',
                title: 'Basic Setup (Node.js)',
                description: 'Initialize the SDK in your Node.js application',
                code: `const Pollarbase = require('@pollarbase/js');

// Initialize with API key
const client = new Pollarbase({
  apiKey: process.env.POLLARBASE_API_KEY,
  environment: 'production', // or 'sandbox'
  timeout: 30000,
  retries: 3
});

// Upload and process file
async function processData(filePath) {
  try {
    const dataset = await client.upload({
      file: filePath,
      autoAnalyze: true,
      qualityThreshold: 0.8
    });
    
    console.log(\`Dataset ID: \${dataset.id}\`);
    console.log(\`Quality Score: \${dataset.qualityScore}%\`);
    
    return dataset;
  } catch (error) {
    console.error('Processing failed:', error.message);
    throw error;
  }
}`,
                response: `Dataset ID: ds_7Qj2mK8fN3xB
Quality Score: 87%`
              })}

              {renderCodeBlock({
                language: 'javascript',
                title: 'Browser Integration with File Upload',
                description: 'Handle file uploads directly in the browser',
                code: `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.pollarbase.com/js/v2.1.0/pollarbase.min.js"></script>
</head>
<body>
  <input type="file" id="fileInput" accept=".csv,.json" />
  <div id="progress"></div>
  <div id="results"></div>

  <script>
    const client = new Pollarbase({
      apiKey: 'pk_test_abc123...',  // Use publishable key for browser
      environment: 'sandbox'
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        // Upload with progress tracking
        const dataset = await client.upload({
          file: file,
          autoAnalyze: true,
          onProgress: (progress) => {
            document.getElementById('progress').innerHTML = 
              \`<div class="progress-bar" style="width: \${progress}%">\${progress}%</div>\`;
          }
        });

        // Display results
        document.getElementById('results').innerHTML = \`
          <h3>Processing Complete!</h3>
          <p>Dataset ID: \${dataset.id}</p>
          <p>Quality Score: \${dataset.qualityScore}%</p>
          <p>Rows: \${dataset.rowCount.toLocaleString()}</p>
          <p>Columns: \${dataset.columnCount}</p>
        \`;

        // Get suggestions if quality is low
        if (dataset.qualityScore < 85) {
          const suggestions = await dataset.getSuggestions();
          suggestions.forEach(suggestion => {
            console.log(\`Suggestion: \${suggestion.description}\`);
          });
        }

      } catch (error) {
        document.getElementById('results').innerHTML = 
          \`<div class="error">Error: \${error.message}</div>\`;
      }
    });
  </script>
</body>
</html>`
              })}
            </div>
          </div>
        )

      case 'webhooks':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Webhooks</h1>
              <p className="text-base text-gray-600 mb-6">
                Receive real-time notifications when your data processing jobs complete.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <h3 className="text-base font-semibold text-blue-900 mb-3">Webhook Events</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-blue-900 mb-2">Dataset Events</div>
                    <ul className="space-y-1 text-blue-700">
                      <li>• <code>dataset.uploaded</code></li>
                      <li>• <code>dataset.analyzed</code></li>
                      <li>• <code>dataset.transformed</code></li>
                      <li>• <code>dataset.exported</code></li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium text-blue-900 mb-2">Job Events</div>
                    <ul className="space-y-1 text-blue-700">
                      <li>• <code>job.started</code></li>
                      <li>• <code>job.completed</code></li>
                      <li>• <code>job.failed</code></li>
                      <li>• <code>job.cancelled</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'javascript',
                title: 'Express.js Webhook Handler',
                description: 'Handle webhook events in your Node.js application',
                code: `const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.raw({ type: 'application/json' }));

// Webhook endpoint
app.post('/webhooks/pollarbase', (req, res) => {
  const signature = req.headers['x-pollarbase-signature'];
  const payload = req.body;
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.POLLARBASE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  if (signature !== \`sha256=\${expectedSignature}\`) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  // Handle different event types
  switch (event.type) {
    case 'dataset.analyzed':
      handleDatasetAnalyzed(event.data);
      break;
      
    case 'dataset.transformed':
      handleDatasetTransformed(event.data);
      break;
      
    case 'job.completed':
      handleJobCompleted(event.data);
      break;
      
    case 'job.failed':
      handleJobFailed(event.data);
      break;
      
    default:
      console.log(\`Unhandled event type: \${event.type}\`);
  }
  
  res.status(200).send('OK');
});

function handleDatasetAnalyzed(data) {
  console.log(\`Dataset \${data.dataset_id} analyzed\`);
  console.log(\`Quality score: \${data.quality_score}%\`);
  
  // Send notification to user
  if (data.quality_score < 70) {
    sendEmailNotification(data.user_email, {
      subject: 'Data quality issue detected',
      message: \`Your dataset has a quality score of \${data.quality_score}%. Consider applying suggested transformations.\`
    });
  }
}

function handleJobCompleted(data) {
  console.log(\`Job \${data.job_id} completed successfully\`);
  
  // Update database
  updateJobStatus(data.job_id, 'completed', {
    output_url: data.output_url,
    metrics: data.metrics
  });
}

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});`,
                response: `Webhook server listening on port 3000
Dataset ds_abc123 analyzed
Quality score: 87%
Job job_xyz789 completed successfully`
              })}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Webhook Configuration</h4>
                <div className="text-sm">
                  <p className="text-gray-600 mb-3">Configure webhooks in your dashboard or via API:</p>
                  <pre className="bg-white p-3 rounded border overflow-x-auto text-xs">
{`curl -X POST "https://api.pollarbase.com/v1/webhooks" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/pollarbase",
    "events": ["dataset.analyzed", "job.completed"],
    "secret": "your_webhook_secret"
  }'`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )

      case 'rest-api':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">REST API</h1>
              <p className="text-base text-gray-600 mb-6">
                Direct HTTP API access for custom integrations and server-to-server communication.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Base URL</h3>
                <code className="text-sm bg-white px-3 py-2 rounded border">https://api.pollarbase.com/v1</code>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Authentication</h4>
                  <div className="text-sm space-y-2">
                    <p className="text-gray-600">Include your API key in the Authorization header:</p>
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
Authorization: Bearer sk-abc123...
                    </pre>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Rate Limits</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Free Plan:</span>
                      <span className="font-medium">100 req/hour</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pro Plan:</span>
                      <span className="font-medium">1,000 req/hour</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Enterprise:</span>
                      <span className="font-medium">Custom</span>
                    </div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'curl',
                title: 'Complete API Workflow',
                description: 'End-to-end data processing via REST API',
                code: `# 1. Upload dataset
curl -X POST "https://api.pollarbase.com/v1/data/upload" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -F "file=@data.csv" \\
  -F "auto_analyze=true"

# 2. Check analysis status
curl -H "Authorization: Bearer sk-abc123..." \\
  "https://api.pollarbase.com/v1/analysis/job_xyz789"

# 3. Get transformation suggestions
curl -H "Authorization: Bearer sk-abc123..." \\
  "https://api.pollarbase.com/v1/datasets/ds_abc123/suggestions"

# 4. Apply transformations
curl -X POST "https://api.pollarbase.com/v1/transform/apply" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "ds_abc123",
    "transformations": [
      {"type": "remove_duplicates"},
      {"type": "fill_missing", "strategy": "median", "columns": ["age"]}
    ]
  }'

# 5. Export processed data
curl -X POST "https://api.pollarbase.com/v1/export/download" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "ds_abc123",
    "format": "csv",
    "include_metadata": true
  }'`,
                response: `Dataset uploaded successfully: ds_abc123
Analysis complete: 87% quality score
3 transformation suggestions available
Transformations applied: +12% quality improvement
Export ready: https://files.pollarbase.com/exports/ds_abc123_cleaned.csv`
              })}
            </div>
          </div>
        )

      case 'complete-pipeline':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Complete Pipeline</h1>
              <p className="text-base text-gray-600 mb-6">
                Build end-to-end data processing pipelines from raw data to ML-ready datasets.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-5">
                <h3 className="text-base font-semibold text-purple-900 mb-3">Pipeline Stages</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                  {['Ingest', 'Validate', 'Clean', 'Transform', 'Export'].map((stage, index) => (
                    <div key={stage} className="text-center">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-purple-600 font-semibold text-xs">{index + 1}</span>
                      </div>
                      <div className="font-medium text-purple-900">{stage}</div>
                    </div>
                  ))}
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Production Pipeline Example',
                description: 'Automated pipeline for processing customer data',
                code: `import pollarbase
import pandas as pd
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CustomerDataPipeline:
    def __init__(self, api_key: str):
        self.client = pollarbase.Client(api_key=api_key)
        self.quality_threshold = 0.85
        
    def process_file(self, file_path: Path) -> dict:
        """Process a single customer data file"""
        logger.info(f"Processing {file_path.name}")
        
        try:
            # 1. Upload and validate
            dataset = self.client.upload_file(
                file_path, 
                auto_analyze=True,
                quality_threshold=self.quality_threshold
            )
            
            # 2. Wait for analysis
            analysis = dataset.wait_for_analysis(timeout=300)
            logger.info(f"Initial quality score: {analysis.quality_score}%")
            
            # 3. Apply automatic transformations if needed
            if analysis.quality_score < self.quality_threshold * 100:
                transformations = self._get_transformations(analysis)
                if transformations:
                    dataset = dataset.apply_transformations(transformations)
                    logger.info(f"Applied {len(transformations)} transformations")
            
            # 4. Validate business rules
            validated_dataset = self._validate_business_rules(dataset)
            
            # 5. Export for different use cases
            exports = self._export_data(validated_dataset)
            
            return {
                'status': 'success',
                'dataset_id': dataset.id,
                'quality_score': dataset.quality_score,
                'exports': exports,
                'metrics': {
                    'rows_processed': dataset.row_count,
                    'columns': dataset.column_count,
                    'processing_time': analysis.processing_time
                }
            }
            
        except Exception as e:
            logger.error(f"Pipeline failed: {str(e)}")
            return {'status': 'failed', 'error': str(e)}
    
    def _get_transformations(self, analysis):
        """Get recommended transformations based on analysis"""
        transformations = []
        
        # Always remove duplicates
        if analysis.duplicates_found > 0:
            transformations.append(pollarbase.RemoveDuplicates())
        
        # Fill critical missing values
        for column, missing_pct in analysis.missing_values.items():
            if missing_pct > 0.1 and column in ['customer_id', 'email']:
                # Remove rows with missing critical fields
                transformations.append(
                    pollarbase.DropMissing(columns=[column])
                )
            elif missing_pct > 0.05:
                # Impute non-critical fields
                transformations.append(
                    pollarbase.FillMissing(columns=[column], strategy='smart')
                )
        
        return transformations
    
    def _validate_business_rules(self, dataset):
        """Apply custom business validation rules"""
        # Example: Validate email domains
        valid_domains = ['company.com', 'enterprise.com']
        
        dataset.add_validation_rule(
            name='valid_email_domain',
            column='email',
            rule=lambda x: any(domain in x for domain in valid_domains),
            action='flag'  # Don't remove, just flag for review
        )
        
        # Example: Age range validation
        dataset.add_validation_rule(
            name='valid_age',
            column='age', 
            rule=lambda x: 18 <= x <= 100,
            action='fix',  # Try to fix automatically
            fix_value=25  # Default age if invalid
        )
        
        return dataset.apply_validation_rules()
    
    def _export_data(self, dataset):
        """Export data in multiple formats for different teams"""
        exports = {}
        
        # For data science team - Parquet with metadata
        exports['ml_ready'] = dataset.export(
            format='parquet',
            include_metadata=True,
            split_ratio={'train': 0.8, 'test': 0.2}
        )
        
        # For analytics team - CSV with documentation
        exports['analytics'] = dataset.export(
            format='csv',
            include_documentation=True
        )
        
        # For reporting - JSON for APIs
        exports['api_ready'] = dataset.export(
            format='json',
            nested=True
        )
        
        return exports

# Usage
if __name__ == "__main__":
    pipeline = CustomerDataPipeline(api_key="sk-abc123...")
    
    # Process multiple files
    data_directory = Path("./customer_data")
    results = []
    
    for file_path in data_directory.glob("*.csv"):
        result = pipeline.process_file(file_path)
        results.append(result)
        
        if result['status'] == 'success':
            logger.info(f"✅ {file_path.name}: {result['quality_score']}% quality")
        else:
            logger.error(f"❌ {file_path.name}: {result['error']}")
    
    # Summary report
    successful = len([r for r in results if r['status'] == 'success'])
    logger.info(f"Pipeline complete: {successful}/{len(results)} files processed successfully")`,
                response: `Processing customer_jan_2024.csv
Initial quality score: 78%
Applied 3 transformations
✅ customer_jan_2024.csv: 89% quality
Processing customer_feb_2024.csv
Initial quality score: 92%
✅ customer_feb_2024.csv: 92% quality
Pipeline complete: 2/2 files processed successfully`
              })}
            </div>
          </div>
        )

      case 'ml-integration':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">ML Integration</h1>
              <p className="text-base text-gray-600 mb-6">
                Seamlessly integrate Pollarbase with popular machine learning frameworks and platforms.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { name: 'TensorFlow', color: 'orange' },
                  { name: 'PyTorch', color: 'red' }, 
                  { name: 'Scikit-learn', color: 'blue' },
                  { name: 'Hugging Face', color: 'yellow' }
                ].map((framework) => (
                  <div key={framework.name} className={`bg-${framework.color}-50 border border-${framework.color}-200 rounded-lg p-4 text-center`}>
                    <div className="text-sm font-semibold text-gray-900">{framework.name}</div>
                    <div className="text-xs text-gray-600 mt-1">Native export support</div>
                  </div>
                ))}
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'TensorFlow Integration',
                description: 'Export data directly to TensorFlow datasets',
                code: `import pollarbase
import tensorflow as tf

# Process data with Pollarbase
client = pollarbase.Client()
dataset = client.get_dataset("ds_abc123")

# Export as TensorFlow dataset
tf_dataset = dataset.to_tensorflow(
    batch_size=32,
    target_column='label',
    feature_columns=['feature1', 'feature2', 'feature3'],
    validation_split=0.2,
    preprocessing={
        'normalize': True,
        'categorical_encoding': 'onehot'
    }
)

# Use directly in model training
model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy']
)

# Train with preprocessed data
history = model.fit(
    tf_dataset['train'],
    validation_data=tf_dataset['validation'],
    epochs=10
)`,
                response: `Exporting to TensorFlow format...
✅ Dataset exported successfully
📊 Training samples: 8,000
📊 Validation samples: 2,000
🎯 Features: 15 (after preprocessing)
Epoch 1/10: loss: 0.6234 - accuracy: 0.6543 - val_accuracy: 0.6789`
              })}

              {renderCodeBlock({
                language: 'python', 
                title: 'MLOps Pipeline with Pollarbase',
                description: 'Integrate with MLflow and other MLOps tools',
                code: `import pollarbase
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# MLflow experiment setup
mlflow.set_experiment("customer_churn_prediction")

with mlflow.start_run():
    # Data preprocessing with Pollarbase
    client = pollarbase.Client()
    dataset = client.get_dataset("customer_data_v2")
    
    # Log data quality metrics
    mlflow.log_metric("data_quality_score", dataset.quality_score)
    mlflow.log_metric("row_count", dataset.row_count)
    
    # Export preprocessed data
    train_data, test_data = dataset.to_sklearn(
        target_column='churned',
        test_size=0.2,
        random_state=42,
        preprocessing={
            'scale_features': True,
            'encode_categorical': True,
            'remove_correlated': True
        }
    )
    
    X_train, y_train = train_data
    X_test, y_test = test_data
    
    # Model training
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    # Prediction and evaluation
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    # Log results to MLflow
    mlflow.log_metric("accuracy", accuracy)
    mlflow.log_param("n_estimators", 100)
    mlflow.log_param("max_depth", 10)
    
    # Log feature importance from Pollarbase analysis
    feature_importance = dataset.get_feature_importance()
    for feature, importance in feature_importance.items():
        mlflow.log_metric(f"feature_importance_{feature}", importance)
    
    # Save model
    mlflow.sklearn.log_model(model, "model")
    
    # Log data lineage
    mlflow.log_param("dataset_id", dataset.id)
    mlflow.log_param("pollarbase_version", pollarbase.__version__)
    
    print(f"Model accuracy: {accuracy:.3f}")
    print(f"Data quality: {dataset.quality_score}%")`,
                response: `Model accuracy: 0.847
Data quality: 94%
MLflow run: https://mlflow.company.com/experiments/1/runs/abc123
Model registered: customer_churn_v2.1`
              })}
            </div>
          </div>
        )

      case 'production-tips':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Production Tips</h1>
              <p className="text-base text-gray-600 mb-6">
                Best practices for deploying Pollarbase in production environments.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                  <h3 className="text-base font-semibold text-green-900 mb-3">Performance Optimization</h3>
                  <ul className="text-sm text-green-800 space-y-2">
                    <li>✓ Use async processing for large files</li>
                    <li>✓ Implement proper retry logic</li>
                    <li>✓ Cache frequently used transformations</li>
                    <li>✓ Monitor API rate limits</li>
                    <li>✓ Use webhooks for status updates</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <h3 className="text-base font-semibold text-blue-900 mb-3">Security & Compliance</h3>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li>✓ Rotate API keys regularly</li>
                    <li>✓ Use environment variables for secrets</li>
                    <li>✓ Enable audit logging</li>
                    <li>✓ Implement data retention policies</li>
                    <li>✓ Validate webhook signatures</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Production-Ready Client Configuration',
                description: 'Robust client setup with retry logic and monitoring',
                code: `import pollarbase
import logging
import time
from tenacity import retry, stop_after_attempt, wait_exponential
from prometheus_client import Counter, Histogram, start_http_server

# Metrics
api_requests = Counter('pollarbase_api_requests_total', ['method', 'status'])
api_duration = Histogram('pollarbase_api_duration_seconds', ['method'])

class ProductionPollarbaseClient:
    def __init__(self, api_key: str, environment: str = 'production'):
        self.client = pollarbase.Client(
            api_key=api_key,
            environment=environment,
            timeout=60,  # Increase timeout for production
            max_retries=3,
            backoff_factor=2.0
        )
        
        # Configure logging
        self.logger = logging.getLogger('pollarbase.client')
        self.logger.setLevel(logging.INFO)
        
        # Add request interceptor for monitoring
        self.client.add_interceptor(self._monitor_requests)
    
    def _monitor_requests(self, method: str, response):
        """Monitor API requests for observability"""
        status = 'success' if response.status_code < 400 else 'error'
        api_requests.labels(method=method, status=status).inc()
        
        if hasattr(response, 'elapsed'):
            api_duration.labels(method=method).observe(response.elapsed.total_seconds())
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def upload_with_retry(self, file_path: str, **kwargs):
        """Upload file with automatic retry on failure"""
        try:
            self.logger.info(f"Uploading {file_path}")
            dataset = self.client.upload_file(file_path, **kwargs)
            self.logger.info(f"Upload successful: {dataset.id}")
            return dataset
            
        except pollarbase.RateLimitError as e:
            self.logger.warning(f"Rate limited, waiting {e.retry_after}s")
            time.sleep(e.retry_after)
            raise  # Retry will handle this
            
        except pollarbase.APIError as e:
            if e.status_code >= 500:
                self.logger.error(f"Server error: {e.message}")
                raise  # Retry server errors
            else:
                self.logger.error(f"Client error: {e.message}")
                return None  # Don't retry client errors
    
    def process_batch(self, file_paths: list, max_concurrent: int = 5):
        """Process multiple files with concurrency control"""
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        async def process_file_async(file_path):
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                return await loop.run_in_executor(
                    executor, 
                    self.upload_with_retry, 
                    file_path
                )
        
        async def process_all():
            semaphore = asyncio.Semaphore(max_concurrent)
            
            async def process_with_semaphore(file_path):
                async with semaphore:
                    return await process_file_async(file_path)
            
            tasks = [process_with_semaphore(fp) for fp in file_paths]
            return await asyncio.gather(*tasks, return_exceptions=True)
        
        return asyncio.run(process_all())

# Usage in production
if __name__ == "__main__":
    # Start Prometheus metrics server
    start_http_server(8000)
    
    # Initialize client
    client = ProductionPollarbaseClient(
        api_key=os.getenv('POLLARBASE_API_KEY'),
        environment='production'
    )
    
    # Process files
    files = ['data1.csv', 'data2.csv', 'data3.csv']
    results = client.process_batch(files, max_concurrent=3)
    
    # Log results
    successful = len([r for r in results if r is not None])
    logging.info(f"Processed {successful}/{len(files)} files successfully")`,
                response: `2024-01-15 10:30:00 INFO Uploading data1.csv
2024-01-15 10:30:02 INFO Upload successful: ds_abc123
2024-01-15 10:30:02 INFO Uploading data2.csv
2024-01-15 10:30:04 INFO Upload successful: ds_def456
Processed 2/3 files successfully
Metrics available at: http://localhost:8000/metrics`
              })}
            </div>
          </div>
        )

      case 'best-practices':
        return (
          <div className="max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Best Practices</h1>
              <p className="text-base text-gray-600 mb-6">
                Recommended patterns and practices for effective use of Pollarbase.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Data Validation</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Always validate file formats before upload</li>
                    <li>• Set quality thresholds for automated processing</li>
                    <li>• Review suggestions before applying transformations</li>
                    <li>• Implement data contracts for consistent schema</li>
                  </ul>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Error Handling</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Implement exponential backoff for retries</li>
                    <li>• Handle rate limits gracefully</li>
                    <li>• Log all API errors for debugging</li>
                    <li>• Use circuit breakers for external services</li>
                  </ul>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Process files asynchronously when possible</li>
                    <li>• Use webhooks instead of polling</li>
                    <li>• Cache transformation results</li>
                    <li>• Optimize file sizes before upload</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                <h3 className="text-base font-semibold text-yellow-900 mb-3">⚠️ Common Pitfalls</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-2">Avoid These Mistakes:</h4>
                    <ul className="text-yellow-800 space-y-1">
                      <li>• Hardcoding API keys in source code</li>
                      <li>• Ignoring quality score recommendations</li>
                      <li>• Not validating data before transformation</li>
                      <li>• Skipping backup before applying changes</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-2">Do This Instead:</h4>
                    <ul className="text-yellow-800 space-y-1">
                      <li>• Use environment variables for secrets</li>
                      <li>• Set up monitoring and alerts</li>
                      <li>• Implement data validation pipelines</li>
                      <li>• Keep original data for rollback scenarios</li>
                    </ul>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Best Practices Implementation',
                description: 'Production-ready code following all best practices',
                code: `import pollarbase
import os
import logging
from dataclasses import dataclass
from typing import List, Optional
import hashlib

@dataclass
class DataValidationRules:
    """Define data validation rules"""
    required_columns: List[str]
    max_missing_percentage: float = 0.1
    min_quality_score: float = 0.8
    allowed_file_types: List[str] = None
    max_file_size_mb: int = 100

class BestPracticeProcessor:
    def __init__(self, api_key: str):
        # ✅ Use environment variables for API keys
        self.client = pollarbase.Client(api_key=api_key)
        self.logger = self._setup_logging()
        
    def _setup_logging(self):
        """✅ Proper logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('pollarbase.log'),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger('pollarbase.processor')
    
    def validate_file(self, file_path: str, rules: DataValidationRules) -> bool:
        """✅ Validate file before processing"""
        import pandas as pd
        
        try:
            # Check file size
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            if file_size_mb > rules.max_file_size_mb:
                self.logger.error(f"File too large: {file_size_mb:.1f}MB > {rules.max_file_size_mb}MB")
                return False
            
            # Check file type
            if rules.allowed_file_types:
                file_ext = file_path.split('.')[-1].lower()
                if file_ext not in rules.allowed_file_types:
                    self.logger.error(f"Invalid file type: {file_ext}")
                    return False
            
            # Basic data validation
            df = pd.read_csv(file_path, nrows=100)  # Sample first 100 rows
            
            # Check required columns
            missing_columns = set(rules.required_columns) - set(df.columns)
            if missing_columns:
                self.logger.error(f"Missing required columns: {missing_columns}")
                return False
            
            self.logger.info(f"✅ File validation passed: {file_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"File validation failed: {str(e)}")
            return False
    
    def create_backup(self, dataset_id: str) -> str:
        """✅ Create backup before transformations"""
        backup_id = f"{dataset_id}_backup_{int(time.time())}"
        
        # Export original data as backup
        backup_export = self.client.get_dataset(dataset_id).export(
            format='parquet',
            filename=f"backup_{backup_id}.parquet"
        )
        
        self.logger.info(f"Backup created: {backup_export['url']}")
        return backup_export['url']
    
    def calculate_file_hash(self, file_path: str) -> str:
        """✅ Calculate file hash for integrity checking"""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def process_with_best_practices(
        self, 
        file_path: str, 
        validation_rules: DataValidationRules
    ) -> Optional[dict]:
        """✅ Complete processing with all best practices"""
        
        # 1. Validate input file
        if not self.validate_file(file_path, validation_rules):
            return None
        
        # 2. Calculate file hash for integrity
        file_hash = self.calculate_file_hash(file_path)
        self.logger.info(f"File hash: {file_hash}")
        
        try:
            # 3. Upload with proper error handling
            dataset = self.client.upload_file(
                file_path,
                auto_analyze=True,
                metadata={'original_hash': file_hash}
            )
            
            # 4. Wait for analysis with timeout
            analysis = dataset.wait_for_analysis(timeout=300)
            
            # 5. Validate quality score
            if analysis.quality_score < validation_rules.min_quality_score * 100:
                self.logger.warning(
                    f"Quality score {analysis.quality_score}% below threshold "
                    f"{validation_rules.min_quality_score * 100}%"
                )
                
                # 6. Create backup before transformations
                backup_url = self.create_backup(dataset.id)
                
                # 7. Apply only high-confidence transformations
                suggestions = analysis.get_suggestions()
                high_confidence = [s for s in suggestions if s.confidence > 0.9]
                
                if high_confidence:
                    self.logger.info(f"Applying {len(high_confidence)} high-confidence transformations")
                    dataset = dataset.apply_transformations(high_confidence)
                else:
                    self.logger.warning("No high-confidence transformations available")
            
            # 8. Final validation
            final_analysis = dataset.get_analysis()
            
            return {
                'status': 'success',
                'dataset_id': dataset.id,
                'quality_score': final_analysis.quality_score,
                'file_hash': file_hash,
                'backup_url': backup_url if 'backup_url' in locals() else None,
                'transformations_applied': len(high_confidence) if 'high_confidence' in locals() else 0
            }
            
        except pollarbase.ValidationError as e:
            self.logger.error(f"Validation error: {e.message}")
            return {'status': 'validation_failed', 'error': e.message}
            
        except pollarbase.RateLimitError as e:
            self.logger.warning(f"Rate limited, retry after {e.retry_after}s")
            return {'status': 'rate_limited', 'retry_after': e.retry_after}
            
        except Exception as e:
            self.logger.error(f"Unexpected error: {str(e)}")
            return {'status': 'failed', 'error': str(e)}

# Usage example
if __name__ == "__main__":
    processor = BestPracticeProcessor(os.getenv('POLLARBASE_API_KEY'))
    
    rules = DataValidationRules(
        required_columns=['customer_id', 'email'],
        max_missing_percentage=0.05,
        min_quality_score=0.85,
        allowed_file_types=['csv', 'json'],
        max_file_size_mb=50
    )
    
    result = processor.process_with_best_practices('customer_data.csv', rules)
    print(f"Processing result: {result}")`,
                response: `2024-01-15 10:30:00 INFO ✅ File validation passed: customer_data.csv
2024-01-15 10:30:00 INFO File hash: d41d8cd98f00b204e9800998ecf8427e
2024-01-15 10:30:05 INFO Quality score 78% below threshold 85%
2024-01-15 10:30:06 INFO Backup created: https://files.pollarbase.com/backups/backup_123.parquet
2024-01-15 10:30:06 INFO Applying 3 high-confidence transformations
Processing result: {'status': 'success', 'dataset_id': 'ds_abc123', 'quality_score': 89, 'transformations_applied': 3}`
              })}
            </div>
          </div>
        )

      case 'rate-limits':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Rate Limits</h1>
              <p className="text-sm text-gray-600 mb-4">
                Understanding API rate limits and how to handle them effectively.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-base font-semibold text-orange-900 mb-3">Rate Limit Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-800">1,000</div>
                    <div className="text-sm text-orange-700">Requests per minute</div>
                    <div className="text-xs text-orange-600">Free & Pro tiers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-800">10,000</div>
                    <div className="text-sm text-orange-700">Requests per minute</div>
                    <div className="text-xs text-orange-600">Enterprise tier</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-800">100MB</div>
                    <div className="text-sm text-orange-700">Max file size</div>
                    <div className="text-xs text-orange-600">Per upload</div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Handle Rate Limits with Exponential Backoff',
                description: 'Implement proper retry logic for rate-limited requests',
                code: `import time
import random
from pollarbase import PollarbaseClient, RateLimitError

def upload_with_retry(client, file_path, max_retries=5):
    for attempt in range(max_retries):
        try:
            result = client.upload(file_path)
            return result
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise e
            
            # Exponential backoff with jitter
            delay = (2 ** attempt) + random.uniform(0, 1)
            print(f"Rate limited. Retrying in {delay:.1f}s...")
            time.sleep(delay)
    
    raise Exception("Max retries exceeded")

# Usage
client = PollarbaseClient(api_key="your_key")
result = upload_with_retry(client, "large_dataset.csv")`,
                response: `Rate limited. Retrying in 1.3s...
Upload successful: dataset_id=ds_abc123`
              })}
            </div>
          </div>
        )

      case 'data-formats':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Supported Data Formats</h1>
              <p className="text-sm text-gray-600 mb-4">
                File formats and data schemas supported by Pollarbase.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Database className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Structured Data</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• CSV (UTF-8, Latin-1)</li>
                    <li>• JSON (single/multi-line)</li>
                    <li>• Parquet</li>
                    <li>• Excel (.xlsx, .xls)</li>
                    <li>• TSV (Tab-separated)</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Code className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Semi-Structured</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• JSON Lines (JSONL)</li>
                    <li>• XML (basic support)</li>
                    <li>• YAML</li>
                    <li>• Nested JSON objects</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Settings className="w-5 h-5 text-purple-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Constraints</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Max 100MB per file</li>
                    <li>• Max 10M rows</li>
                    <li>• Max 1000 columns</li>
                    <li>• UTF-8 or Latin-1 encoding</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Upload Different File Formats',
                description: 'Examples of uploading various data formats',
                code: `# CSV with custom options
csv_result = client.upload(
    file_path='data.csv',
    encoding='utf-8',
    delimiter=',',
    has_header=True
)

# JSON with nested objects
json_result = client.upload(
    file_path='nested_data.json',
    flatten_nested=True,
    max_nesting_depth=3
)

# Excel with sheet selection
excel_result = client.upload(
    file_path='workbook.xlsx',
    sheet_name='Sheet1',  # or sheet index: 0
    skip_rows=1
)

# Parquet (most efficient)
parquet_result = client.upload(
    file_path='big_data.parquet',
    auto_analyze=True
)`,
                response: `CSV uploaded: 45,231 rows, 12 columns
JSON uploaded: 8,942 records, flattened to 18 columns  
Excel uploaded: 12,045 rows from Sheet1
Parquet uploaded: 1,234,567 rows (fastest format)`
              })}
            </div>
          </div>
        )

      case 'pagination':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Pagination</h1>
              <p className="text-sm text-gray-600 mb-4">
                Handle large result sets efficiently with cursor-based pagination.
              </p>
            </div>

            <div className="space-y-4">
              {renderCodeBlock({
                language: 'python',
                title: 'Paginate Through Datasets',
                description: 'Efficiently retrieve large lists of datasets',
                code: `# Get first page
response = client.datasets.list(limit=50)
datasets = response.data
next_cursor = response.next_cursor

print(f"Retrieved {len(datasets)} datasets")

# Get subsequent pages
all_datasets = datasets.copy()
while next_cursor:
    response = client.datasets.list(
        limit=50, 
        cursor=next_cursor
    )
    all_datasets.extend(response.data)
    next_cursor = response.next_cursor
    
    print(f"Total datasets so far: {len(all_datasets)}")

print(f"Retrieved all {len(all_datasets)} datasets")`,
                response: `Retrieved 50 datasets
Total datasets so far: 100
Total datasets so far: 150
Retrieved all 147 datasets`
              })}

              {renderCodeBlock({
                language: 'javascript',
                title: 'Async Pagination with Generator',
                description: 'Modern JavaScript pagination using async generators',
                code: `// Async generator for pagination
async function* paginateDatasets(client, limit = 50) {
  let cursor = null;
  
  do {
    const response = await client.datasets.list({
      limit,
      cursor
    });
    
    for (const dataset of response.data) {
      yield dataset;
    }
    
    cursor = response.next_cursor;
  } while (cursor);
}

// Usage
const client = new PollarbaseClient(apiKey);

for await (const dataset of paginateDatasets(client)) {
  console.log(\`Dataset: \${dataset.name} - Quality: \${dataset.quality_score}%\`);
  
  // Process each dataset individually
  if (dataset.quality_score < 80) {
    await improveDatasetQuality(dataset.id);
  }
}`,
                response: `Dataset: sales_2023.csv - Quality: 87%
Dataset: customers.json - Quality: 72%
Dataset: inventory.parquet - Quality: 95%`
              })}
            </div>
          </div>
        )

      case 'monitoring':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Monitoring & Logging</h1>
              <p className="text-sm text-gray-600 mb-4">
                Track API usage, performance, and debug issues effectively.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Activity className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Usage Metrics</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• API request counts</li>
                    <li>• Data processing volume</li>
                    <li>• Response time trends</li>
                    <li>• Error rates by endpoint</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Terminal className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Request Logging</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Request/response headers</li>
                    <li>• Execution time breakdown</li>
                    <li>• Error stack traces</li>
                    <li>• Custom metadata tags</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Enable Request Logging',
                description: 'Configure detailed logging for debugging and monitoring',
                code: `import logging
from pollarbase import PollarbaseClient

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('pollarbase')

# Enable request logging
client = PollarbaseClient(
    api_key="your_key",
    debug=True,
    log_requests=True,
    request_timeout=30
)

# Add custom metadata to requests
with client.request_context(
    user_id="user_123",
    session_id="session_abc",
    environment="production"
):
    result = client.upload(
        file_path="data.csv",
        tags=["daily_batch", "sales_data"]
    )
    
    analysis = client.analyze(
        dataset_id=result.id,
        include_insights=True
    )

print(f"Upload ID: {result.id}")
print(f"Processing time: {analysis.processing_time_ms}ms")`,
                response: `[2024-01-15 10:30:00] DEBUG Request: POST /v1/data/upload
[2024-01-15 10:30:00] DEBUG Headers: Content-Type: multipart/form-data
[2024-01-15 10:30:02] DEBUG Response: 200 OK (2.1s)
[2024-01-15 10:30:02] INFO Upload completed: ds_abc123
Upload ID: ds_abc123
Processing time: 2847ms`
              })}
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Security Best Practices</h1>
              <p className="text-sm text-gray-600 mb-4">
                Secure your API integrations and protect sensitive data.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-base font-semibold text-red-900 mb-3">Security Checklist</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-2">API Key Management</h4>
                    <ul className="text-xs text-red-700 space-y-1">
                      <li>• Use environment variables</li>
                      <li>• Rotate keys regularly</li>
                      <li>• Different keys per environment</li>
                      <li>• Monitor key usage</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-2">Data Protection</h4>
                    <ul className="text-xs text-red-700 space-y-1">
                      <li>• Enable data encryption</li>
                      <li>• Use secure file transfers</li>
                      <li>• Implement data retention policies</li>
                      <li>• Regular security audits</li>
                    </ul>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Secure Client Configuration',
                description: 'Set up the client with security best practices',
                code: `import os
from pollarbase import PollarbaseClient
from pollarbase.security import DataEncryption

# Use environment variables for sensitive data
client = PollarbaseClient(
    api_key=os.getenv('POLLARBASE_API_KEY'),
    environment=os.getenv('POLLARBASE_ENV', 'sandbox'),
    
    # Enable security features
    verify_ssl=True,
    enable_encryption=True,
    data_retention_days=30,
    
    # Request signing for extra security
    enable_request_signing=True,
    signing_key=os.getenv('POLLARBASE_SIGNING_KEY')
)

# Upload with encryption
encrypted_upload = client.upload(
    file_path='sensitive_data.csv',
    encrypt_data=True,
    encryption_key=os.getenv('DATA_ENCRYPTION_KEY'),
    
    # Set access controls
    access_level='restricted',
    allowed_users=['user1@company.com', 'user2@company.com'],
    
    # Auto-delete after processing
    auto_delete_after=7  # days
)

print(f"Secure upload: {encrypted_upload.id}")
print(f"Encryption status: {encrypted_upload.encryption_enabled}")`,
                response: `Secure upload: ds_encrypted_abc123
Encryption status: True
Data retention: 7 days
Access level: restricted`
              })}
            </div>
          </div>
        )

      case 'troubleshooting':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Troubleshooting</h1>
              <p className="text-sm text-gray-600 mb-4">
                Common issues and solutions for API integration problems.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                    Upload Failures
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>File too large:</strong> Split files over 100MB or use streaming upload</div>
                    <div><strong>Encoding issues:</strong> Ensure UTF-8 encoding or specify encoding explicitly</div>
                    <div><strong>Network timeouts:</strong> Increase timeout settings for large files</div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                    <Clock className="w-4 h-4 text-yellow-500 mr-2" />
                    Performance Issues
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Slow processing:</strong> Use Parquet format for better performance</div>
                    <div><strong>API timeouts:</strong> Implement proper retry logic with exponential backoff</div>
                    <div><strong>Memory errors:</strong> Process data in smaller batches</div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Debug API Issues',
                description: 'Comprehensive error handling and debugging',
                code: `import logging
from pollarbase import PollarbaseClient, PollarbaseError
from pollarbase.exceptions import (
    AuthenticationError,
    RateLimitError, 
    ValidationError,
    NetworkError
)

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
client = PollarbaseClient(api_key="your_key", debug=True)

def robust_upload(file_path):
    try:
        result = client.upload(
            file_path=file_path,
            timeout=300,  # 5 minutes
            retry_count=3
        )
        return result
        
    except AuthenticationError as e:
        print(f"Auth error: Check your API key - {e}")
        
    except RateLimitError as e:
        print(f"Rate limited: {e.retry_after} seconds")
        # Implement backoff logic here
        
    except ValidationError as e:
        print(f"Validation failed: {e.details}")
        # Check file format and size
        
    except NetworkError as e:
        print(f"Network issue: {e}. Check connectivity.")
        
    except PollarbaseError as e:
        print(f"API error [{e.error_code}]: {e.message}")
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        # Log full traceback for debugging
        logging.exception("Upload failed")

# Usage with debugging
result = robust_upload("problematic_file.csv")`,
                response: `[DEBUG] Uploading file: problematic_file.csv (45.2MB)
[DEBUG] Request headers: Content-Type, Authorization, User-Agent
[ERROR] Validation failed: {'encoding': 'File encoding not supported'}
Validation failed: {'encoding': 'File encoding not supported', 'suggestion': 'Convert to UTF-8'}
[DEBUG] Upload aborted due to validation error`
              })}
            </div>
          </div>
        )

      case 'python-sdk':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Python SDK</h1>
              <p className="text-sm text-gray-600 mb-4">
                The most comprehensive way to integrate Pollarbase into Python applications.
              </p>
            </div>

            <div className="space-y-6">
              {renderCodeBlock({
                language: 'bash',
                title: 'Installation',
                description: 'Install the Python SDK via pip',
                code: `# Install the latest version
pip install pollarbase

# Or install specific version
pip install pollarbase==2.1.0

# For development
pip install pollarbase[dev]`
              })}

              {renderCodeBlock({
                language: 'python',
                title: 'Complete Workflow Example',
                description: 'End-to-end data processing with the Python SDK',
                code: `import pollarbase as pb
import pandas as pd

# Initialize client
client = pb.Client(
    api_key=os.getenv('POLLARBASE_API_KEY'),
    environment='production'
)

# Upload dataset
dataset = client.upload(
    file_path='sales_data.csv',
    auto_analyze=True,
    tags=['sales', 'quarterly']
)

# Wait for analysis
dataset.wait_for_completion(timeout=300)

# Get quality insights
print(f"Quality Score: {dataset.quality_score}%")
insights = dataset.get_insights()
for insight in insights:
    print(f"- {insight.message}")

# Apply recommended transformations
transformations = dataset.get_recommended_transformations()
preview = dataset.preview_transformations(transformations)
print(f"Expected improvement: +{preview.quality_improvement}%")

if preview.quality_improvement > 10:
    dataset.apply_transformations(transformations)

# Export clean data
clean_df = dataset.to_pandas()
clean_df.to_csv('clean_sales_data.csv', index=False)`,
                response: `Quality Score: 87%
- Filled 342 missing values in revenue column
- Removed 12 duplicate transactions
- Standardized date formats across 3 columns
- Detected 5 potential outliers in price column
Expected improvement: +8%`
              })}
            </div>
          </div>
        )

      case 'filtering':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Filtering & Search</h1>
              <p className="text-sm text-gray-600 mb-4">
                Search and filter datasets using query parameters and advanced filters.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Search className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Search Options</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Full-text search</li>
                    <li>• Filter by tags</li>
                    <li>• Date range filters</li>
                    <li>• Quality score ranges</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Filter className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Advanced Filters</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• File format filtering</li>
                    <li>• Size-based filtering</li>
                    <li>• Processing status</li>
                    <li>• Custom metadata</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Search and Filter Datasets',
                description: 'Use various filters to find specific datasets',
                code: `# Basic search
results = client.datasets.search(
    query="sales data",
    limit=20
)

# Filter by tags and quality
filtered_results = client.datasets.list(
    tags=["production", "daily"],
    quality_score_min=80,
    created_after="2024-01-01",
    file_format="csv"
)

# Advanced filtering with multiple criteria
advanced_search = client.datasets.search(
    query="customer",
    filters={
        "quality_score": {"min": 75, "max": 100},
        "file_size": {"max": "50MB"},
        "processing_status": "completed",
        "tags": {"any": ["sales", "marketing"]},
        "columns": {"contains": ["email", "customer_id"]},
        "created_date": {
            "after": "2024-01-01",
            "before": "2024-01-31"
        }
    },
    sort_by="quality_score",
    order="desc"
)

print(f"Found {len(advanced_search.data)} datasets")
for dataset in advanced_search.data:
    print(f"- {dataset.name}: {dataset.quality_score}%")`,
                response: `Found 12 datasets
- customer_profiles_2024.csv: 94%
- customer_transactions.json: 89% 
- customer_feedback.xlsx: 87%
- customer_support_logs.csv: 82%`
              })}
            </div>
          </div>
        )

      case 'testing':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Testing</h1>
              <p className="text-sm text-gray-600 mb-4">
                Test your Pollarbase integrations effectively with our testing tools.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-base font-semibold text-green-900 mb-3">Testing Environments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-green-800 mb-2">Sandbox Mode</h4>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• No real data processing</li>
                      <li>• Fast mock responses</li>
                      <li>• Free API calls</li>
                      <li>• Test error scenarios</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-green-800 mb-2">Test Data</h4>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• Sample datasets provided</li>
                      <li>• Synthetic data generation</li>
                      <li>• Various file formats</li>
                      <li>• Known quality issues</li>
                    </ul>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Unit Testing with Pollarbase',
                description: 'Write comprehensive tests for your data processing pipeline',
                code: `import unittest
from unittest.mock import patch, MagicMock
from pollarbase import PollarbaseClient
from pollarbase.testing import MockClient, SampleData

class TestDataProcessing(unittest.TestCase):
    
    def setUp(self):
        # Use sandbox environment for testing
        self.client = PollarbaseClient(
            api_key="test_key",
            environment="sandbox"
        )
        
        # Or use mock client for unit tests
        self.mock_client = MockClient()
    
    def test_upload_success(self):
        """Test successful file upload"""
        # Use sample data for testing
        test_file = SampleData.create_csv(
            rows=1000,
            columns=["name", "email", "age"],
            quality_issues=["missing_values", "duplicates"]
        )
        
        result = self.client.upload(test_file.path)
        
        self.assertIsNotNone(result.id)
        self.assertEqual(result.status, "uploaded")
        self.assertGreater(result.file_size, 0)
    
    def test_rate_limit_handling(self):
        """Test rate limit error handling"""
        with patch.object(self.client, '_make_request') as mock_request:
            # Simulate rate limit error
            mock_request.side_effect = RateLimitError("Rate limit exceeded")
            
            with self.assertRaises(RateLimitError):
                self.client.upload("test.csv")
    
    def test_quality_threshold(self):
        """Test quality score validation"""
        # Create low-quality test data
        low_quality_data = SampleData.create_csv(
            rows=100,
            quality_score=0.45  # Below threshold
        )
        
        result = self.client.upload(
            low_quality_data.path,
            min_quality_threshold=0.8
        )
        
        # Should trigger quality improvement suggestions
        self.assertTrue(result.needs_improvement)
        self.assertGreater(len(result.suggestions), 0)

if __name__ == '__main__':
    unittest.main()`,
                response: `...
test_upload_success (__main__.TestDataProcessing) ... ok
test_rate_limit_handling (__main__.TestDataProcessing) ... ok  
test_quality_threshold (__main__.TestDataProcessing) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.012s

OK`
              })}
            </div>
          </div>
        )

      case 'performance':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Performance Optimization</h1>
              <p className="text-sm text-gray-600 mb-4">
                Tips and techniques to optimize your API usage and data processing speed.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">File Optimization</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Use Parquet format</li>
                    <li>• Compress before upload</li>
                    <li>• Remove unnecessary columns</li>
                    <li>• Batch similar files</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Zap className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">API Efficiency</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Use async requests</li>
                    <li>• Implement connection pooling</li>
                    <li>• Cache results locally</li>
                    <li>• Use webhooks vs polling</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Settings className="w-5 h-5 text-purple-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Processing Speed</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Enable auto-transforms</li>
                    <li>• Use quality thresholds</li>
                    <li>• Process in parallel</li>
                    <li>• Monitor queue times</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'High-Performance Data Processing',
                description: 'Optimize your data processing pipeline for maximum speed',
                code: `import asyncio
import aiofiles
from pollarbase import AsyncPollarbaseClient
from concurrent.futures import ThreadPoolExecutor
import pandas as pd

async def optimize_and_upload(client, file_path):
    """Optimize file before upload for better performance"""
    
    # 1. Optimize file format (convert to Parquet if needed)
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
        
        # Remove empty columns and optimize dtypes
        df = df.dropna(axis=1, how='all')
        df = df.convert_dtypes()
        
        # Save as optimized Parquet
        optimized_path = file_path.replace('.csv', '_optimized.parquet')
        df.to_parquet(optimized_path, compression='snappy')
        file_path = optimized_path
    
    # 2. Upload with optimal settings
    result = await client.upload(
        file_path=file_path,
        auto_analyze=True,
        auto_transform=True,
        quality_threshold=0.8,
        
        # Performance optimizations
        chunk_size=8192,  # Larger chunks for faster upload
        compression='gzip',
        parallel_processing=True
    )
    
    return result

async def batch_process_files(file_paths, max_concurrent=5):
    """Process multiple files concurrently"""
    
    client = AsyncPollarbaseClient(
        api_key="your_key",
        # Connection pooling for better performance
        max_connections=20,
        connection_timeout=30
    )
    
    # Create semaphore to limit concurrent uploads
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_with_semaphore(file_path):
        async with semaphore:
            return await optimize_and_upload(client, file_path)
    
    # Process all files concurrently
    tasks = [process_with_semaphore(fp) for fp in file_paths]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful = [r for r in results if not isinstance(r, Exception)]
    failed = [r for r in results if isinstance(r, Exception)]
    
    print(f"Successfully processed: {len(successful)}")
    print(f"Failed: {len(failed)}")
    
    return successful

# Usage
files = ["data1.csv", "data2.csv", "data3.csv", "data4.csv"]
results = asyncio.run(batch_process_files(files))`,
                response: `Optimizing data1.csv: 45MB -> 12MB (73% reduction)
Optimizing data2.csv: 67MB -> 18MB (73% reduction)
Uploading 4 files concurrently...
Successfully processed: 4
Failed: 0
Total processing time: 23.4 seconds (avg 5.8s per file)`
              })}
            </div>
          </div>
        )

      case 'enterprise':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Enterprise Features</h1>
              <p className="text-sm text-gray-600 mb-4">
                Advanced capabilities and features available for enterprise customers.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                  <Shield className="w-5 h-5 text-purple-600 mb-2" />
                  <h4 className="text-sm font-semibold text-purple-900 mb-2">Enhanced Security</h4>
                  <ul className="text-xs text-purple-700 space-y-1">
                    <li>• SSO integration (SAML, OIDC)</li>
                    <li>• Role-based access control</li>
                    <li>• Audit logging & compliance</li>
                    <li>• Private cloud deployment</li>
                    <li>• Custom encryption keys</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                  <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Advanced Analytics</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Custom ML models</li>
                    <li>• Advanced anomaly detection</li>
                    <li>• Predictive quality scoring</li>
                    <li>• Real-time data streams</li>
                    <li>• Custom transformations</li>
                  </ul>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                  <Settings className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-semibold text-green-900 mb-2">Infrastructure</h4>
                  <ul className="text-xs text-green-700 space-y-1">
                    <li>• Dedicated compute resources</li>
                    <li>• Custom SLA guarantees</li>
                    <li>• Priority processing queues</li>
                    <li>• Multi-region deployment</li>
                    <li>• 24/7 technical support</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                  <Brain className="w-5 h-5 text-yellow-600 mb-2" />
                  <h4 className="text-sm font-semibold text-yellow-900 mb-2">AI & Automation</h4>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    <li>• Auto-scaling processing</li>
                    <li>• Intelligent data routing</li>
                    <li>• Custom workflow automation</li>
                    <li>• Advanced data lineage</li>
                    <li>• API governance tools</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Enterprise Client Configuration',
                description: 'Configure the client with enterprise features enabled',
                code: `from pollarbase.enterprise import EnterpriseClient

# Initialize enterprise client
client = EnterpriseClient(
    api_key=os.getenv('POLLARBASE_ENTERPRISE_KEY'),
    organization_id='org_enterprise_123',
    
    # Enterprise security settings
    sso_provider='okta',
    custom_encryption_key=os.getenv('CUSTOM_ENCRYPTION_KEY'),
    audit_logging=True,
    
    # Performance settings
    dedicated_compute=True,
    priority_queue='high',
    multi_region=True,
    
    # Advanced features
    custom_ml_models=True,
    real_time_processing=True
)

# Upload with enterprise features
result = client.upload(
    file_path='enterprise_data.csv',
    
    # Enhanced processing
    use_custom_models=True,
    real_time_analysis=True,
    advanced_anomaly_detection=True,
    
    # Security & compliance
    compliance_tags=['SOX', 'GDPR', 'HIPAA'],
    data_classification='sensitive',
    retention_policy='7_years',
    
    # Performance optimization
    dedicated_resources=True,
    priority_processing=True
)

# Enterprise analytics
analytics = client.get_advanced_analytics(
    dataset_id=result.id,
    include_predictions=True,
    include_lineage=True,
    include_compliance_report=True
)

print(f"Enterprise upload: {result.id}")
print(f"Processing time: {result.processing_time_ms}ms")
print(f"Compliance status: {analytics.compliance_status}")`,
                response: `Enterprise upload: ds_enterprise_abc123
Processing time: 245ms (dedicated compute)
Compliance status: GDPR✓ SOX✓ HIPAA✓
Advanced analytics: 15 predictive insights
Data lineage: 3 upstream sources tracked`
              })}
            </div>
          </div>
        )

      case 'billing':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Billing & Usage</h1>
              <p className="text-sm text-gray-600 mb-4">
                Understanding pricing, usage tracking, and billing for Pollarbase services.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-base font-semibold text-blue-900 mb-3">Pricing Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-800">Free</div>
                    <div className="text-sm text-blue-700">Up to 100MB/month</div>
                    <div className="text-xs text-blue-600">Basic features</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-800">Pro - $49/mo</div>
                    <div className="text-sm text-blue-700">Up to 10GB/month</div>
                    <div className="text-xs text-blue-600">Advanced features</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-800">Enterprise</div>
                    <div className="text-sm text-blue-700">Custom pricing</div>
                    <div className="text-xs text-blue-600">All features</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <BarChart3 className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Usage Metrics</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Data processed (MB/GB)</li>
                    <li>• API requests count</li>
                    <li>• Storage usage</li>
                    <li>• Compute time (minutes)</li>
                    <li>• Advanced features usage</li>
                  </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <Clock className="w-5 h-5 text-purple-600 mb-2" />
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Billing Cycle</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Monthly billing cycle</li>
                    <li>• Usage tracked in real-time</li>
                    <li>• Overage alerts available</li>
                    <li>• Detailed usage reports</li>
                    <li>• Export billing data</li>
                  </ul>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Monitor Usage and Billing',
                description: 'Track your API usage and monitor billing information',
                code: `# Get current usage statistics
usage = client.billing.get_usage(
    period='current_month'  # or 'last_30_days', 'last_7_days'
)

print("Current Usage:")
print(f"Data processed: {usage.data_processed_mb:.1f} MB")
print(f"API requests: {usage.api_requests:,}")
print(f"Storage used: {usage.storage_mb:.1f} MB")
print(f"Compute minutes: {usage.compute_minutes:.1f}")

# Check remaining quota
quota = client.billing.get_quota()
print(f"\\nRemaining quota:")
print(f"Data: {quota.data_remaining_mb:.1f} MB / {quota.data_limit_mb} MB")
print(f"Requests: {quota.requests_remaining:,} / {quota.requests_limit:,}")

# Get detailed billing information
billing = client.billing.get_current_bill()
print(f"\\nCurrent bill: ${'$'}{billing.amount:.2f}")
print(f"Due date: {'{'}{billing.due_date}{'}'}")

# Set up usage alerts
client.billing.set_alert(
    threshold_percentage=80,  # Alert at 80% usage
    alert_type='data_usage',
    notification_email='admin@company.com'
)

# Get usage by feature
feature_usage = client.billing.get_feature_usage()
for feature, usage in feature_usage.items():
    print(f"{'{'}{feature}{'}'}: {'{'}{usage.count}{'}'} uses, ${'$'}{'{'}{usage.cost:.2f}{'}'}")`,
                response: `Current Usage:
Data processed: 2,456.3 MB
API requests: 15,342
Storage used: 1,234.5 MB
Compute minutes: 45.2

Remaining quota:
Data: 7,543.7 MB / 10,000 MB
Requests: 84,658 / 100,000

Current bill: $31.45
Due date: 2024-02-01

Alert set: Email notification at 80% data usage
Advanced analytics: 42 uses, $8.40
Custom transformations: 15 uses, $7.50
Real-time processing: 8 uses, $12.00`
              })}
            </div>
          </div>
        )

      case 'changelog':
        return (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Changelog</h1>
              <p className="text-sm text-gray-600 mb-4">
                Recent updates, new features, and improvements to the Pollarbase platform.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Version 2.1.0</h3>
                  <span className="text-xs text-gray-500">January 15, 2024</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>New:</strong> Enhanced ML models for better anomaly detection accuracy
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Improved:</strong> 40% faster processing for large CSV files
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Added:</strong> Real-time data streaming capabilities for enterprise
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Version 2.0.5</h3>
                  <span className="text-xs text-gray-500">January 8, 2024</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Fixed:</strong> Memory leak in batch processing for files over 50MB
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Improved:</strong> API response times reduced by 25% average
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Version 2.0.0</h3>
                  <span className="text-xs text-gray-500">December 20, 2023</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Major:</strong> Complete API redesign with improved developer experience
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>New:</strong> Python SDK with async support and better error handling
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Added:</strong> Advanced data transformation engine
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5"></div>
                    <div className="text-sm text-gray-700">
                      <strong>Breaking:</strong> API v1 deprecated, migration guide available
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Stay Updated</h4>
                <p className="text-xs text-blue-700 mb-3">
                  Get notified about new releases and important updates.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a href="https://github.com/pollarbase/api/releases" 
                     className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors">
                    GitHub Releases
                  </a>
                  <a href="https://status.pollarbase.com" 
                     className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors">
                    Status Page
                  </a>
                  <a href="mailto:updates@pollarbase.com?subject=Subscribe to updates" 
                     className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors">
                    Email Updates
                  </a>
                </div>
              </div>
            </div>
          </div>
        )

      case 'anomaly-detection':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Anomaly Detection</h1>
              <p className="text-sm text-gray-600">
                Automatically detect outliers, inconsistencies, and unusual patterns in your data using advanced ML algorithms.
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 mb-8">
              <div className="flex items-start space-x-4">
                <Filter className="w-8 h-8 text-purple-600 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-purple-900 mb-3">Advanced ML-Powered Detection</h3>
                  <p className="text-purple-800 leading-relaxed mb-4">
                    Pollarbase uses ensemble methods combining statistical analysis, isolation forests, 
                    autoencoders, and clustering algorithms to identify anomalies with <strong>95%+ accuracy</strong>.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white/70 rounded-md p-3">
                      <h4 className="font-semibold text-purple-900 text-sm mb-1">Statistical Outliers</h4>
                      <p className="text-xs text-purple-700">Z-score, IQR, Grubbs test</p>
                    </div>
                    <div className="bg-white/70 rounded-md p-3">
                      <h4 className="font-semibold text-purple-900 text-sm mb-1">Pattern Anomalies</h4>
                      <p className="text-xs text-purple-700">Isolation Forest, LOF</p>
                    </div>
                    <div className="bg-white/70 rounded-md p-3">
                      <h4 className="font-semibold text-purple-900 text-sm mb-1">Deep Learning</h4>
                      <p className="text-xs text-purple-700">Autoencoders, LSTM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Types of Anomalies Detected</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center space-x-3 mb-3">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <h3 className="font-semibold text-gray-900">Point Anomalies</h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Extreme values outside normal range</li>
                      <li>• Data entry errors (negative ages, future dates)</li>
                      <li>• Measurement errors and sensor malfunctions</li>
                      <li>• Fraudulent transactions or activities</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center space-x-3 mb-3">
                      <TrendingUp className="w-5 h-5 text-orange-500" />
                      <h3 className="font-semibold text-gray-900">Contextual Anomalies</h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Time-based patterns (holiday traffic spikes)</li>
                      <li>• Seasonal variations and cyclical trends</li>
                      <li>• Geographic or demographic inconsistencies</li>
                      <li>• Business rule violations</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center space-x-3 mb-3">
                      <Layers className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-gray-900">Collective Anomalies</h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Unusual patterns in data sequences</li>
                      <li>• Coordinated fraudulent behavior</li>
                      <li>• System-wide performance degradation</li>
                      <li>• Market manipulation patterns</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center space-x-3 mb-3">
                      <Brain className="w-5 h-5 text-purple-500" />
                      <h3 className="font-semibold text-gray-900">Schema Anomalies</h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Unexpected data types or formats</li>
                      <li>• Missing or extra columns</li>
                      <li>• Encoding inconsistencies</li>
                      <li>• Structure violations</li>
                    </ul>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Basic Anomaly Detection',
                description: 'Detect anomalies in your dataset with a single function call',
                code: `import pollarbase

client = pollarbase.Client()

# Upload and detect anomalies
dataset = client.upload_file("sales_data.csv")
anomaly_results = dataset.detect_anomalies(
    methods=['statistical', 'isolation_forest', 'autoencoder'],
    confidence_threshold=0.85,
    return_scores=True
)

print(f"Total anomalies found: {len(anomaly_results.anomalies)}")
print(f"Anomaly rate: {anomaly_results.anomaly_rate:.2%}")

# Review detected anomalies
for anomaly in anomaly_results.anomalies[:5]:
    print(f"Row {anomaly.row_index}: {anomaly.type}")
    print(f"  Confidence: {anomaly.confidence:.2%}")
    print(f"  Reason: {anomaly.explanation}")
    print(f"  Values: {anomaly.anomalous_values}")
    print("---")

# Get anomaly distribution by column
column_stats = anomaly_results.get_column_statistics()
for column, stats in column_stats.items():
    if stats['anomaly_count'] > 0:
        print(f"{column}: {stats['anomaly_count']} anomalies ({stats['anomaly_rate']:.1%})")`,
                response: `Total anomalies found: 47
Anomaly rate: 2.35%

Row 234: Point Anomaly
  Confidence: 96.3%
  Reason: Sales amount $-2,450 is negative (impossible value)
  Values: {'sales_amount': -2450.0}
---
Row 891: Contextual Anomaly  
  Confidence: 87.2%
  Reason: Purchase on 2025-01-15 is in the future
  Values: {'purchase_date': '2025-01-15'}
---
Row 1205: Statistical Outlier
  Confidence: 92.8%
  Reason: Age 347 exceeds 3.5 standard deviations from mean
  Values: {'customer_age': 347}
---

sales_amount: 12 anomalies (0.6%)
customer_age: 8 anomalies (0.4%)
purchase_date: 15 anomalies (0.8%)
email: 12 anomalies (0.6%)`
              })}

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-green-900 mb-3">Best Practices</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-green-800 mb-2 text-sm">Detection Strategy</h4>
                        <ul className="text-green-700 space-y-1 text-xs">
                          <li>• Use ensemble methods for higher accuracy</li>
                          <li>• Set appropriate confidence thresholds</li>
                          <li>• Consider domain-specific rules</li>
                          <li>• Validate results with business experts</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-green-800 mb-2 text-sm">Handling Anomalies</h4>
                        <ul className="text-green-700 space-y-1 text-xs">
                          <li>• Document all corrections and removals</li>
                          <li>• Preserve original data before modifications</li>
                          <li>• Review patterns in anomalies regularly</li>
                          <li>• Monitor false positive rates</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'upload-api':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Upload API</h1>
              <p className="text-sm text-gray-600">
                Upload datasets in various formats (CSV, JSON, Parquet) with automatic analysis and validation.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Endpoints</h2>
                <div className="space-y-4">
                  {apiEndpoints['upload-api']?.map((endpoint, index) => (
                    <div key={index}>
                      {renderAPIEndpoint(endpoint)}
                    </div>
                  ))}
                </div>
              </div>

              {renderCodeBlock({
                language: 'curl',
                title: 'Upload CSV with Auto-Analysis',
                description: 'Upload a CSV file and automatically run quality analysis',
                code: `curl -X POST "https://api.pollarbase.com/v1/data/upload" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@customer_data.csv" \\
  -F "auto_analyze=true" \\
  -F "quality_threshold=0.8" \\
  -F "detect_anomalies=true" \\
  -F "include_ml_insights=true"`,
                response: `{
  "dataset_id": "ds_7Qj2mK8fN3xB",
  "status": "processing",
  "name": "customer_data.csv",
  "size_bytes": 524288,
  "rows": 10000,
  "columns": 12,
  "file_format": "csv",
  "encoding": "utf-8",
  "analysis_job_id": "job_3fD8kL1mP7nX",
  "estimated_completion": "2024-06-28T15:35:00Z",
  "webhook_url": null
}`
              })}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-800 mb-2">Upload Limits & Best Practices</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-yellow-700">
                      <div>
                        <h4 className="font-medium mb-1">File Limits</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Maximum file size: 5GB</li>
                          <li>• Concurrent uploads: 10 files</li>
                          <li>• Daily upload limit: 100GB</li>
                          <li>• Supported formats: CSV, JSON, Parquet, Excel</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Performance Tips</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Use Parquet for large datasets</li>
                          <li>• Enable compression for faster uploads</li>
                          <li>• Batch related files together</li>
                          <li>• Set appropriate chunk sizes</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'analysis-api':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Analysis API</h1>
              <p className="text-sm text-gray-600">
                Run comprehensive AI-powered analysis on your datasets including quality scoring, insights, and recommendations.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Endpoints</h2>
                <div className="space-y-4">
                  {apiEndpoints['analysis-api']?.map((endpoint, index) => (
                    <div key={index}>
                      {renderAPIEndpoint(endpoint)}
                    </div>
                  ))}
                </div>
              </div>

              {renderCodeBlock({
                language: 'curl',
                title: 'Start Analysis Job',
                description: 'Initiate comprehensive analysis with ML insights and anomaly detection',
                code: `curl -X POST "https://api.pollarbase.com/v1/analysis/analyze" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "ds_7Qj2mK8fN3xB",
    "include_ml_insights": true,
    "detect_anomalies": true,
    "quality_threshold": 0.85,
    "analysis_depth": "comprehensive",
    "webhook_url": "https://your-app.com/webhook"
  }'`,
                response: `{
  "analysis_id": "ana_4gE7nR2sK9mQ",
  "dataset_id": "ds_7Qj2mK8fN3xB",
  "status": "running",
  "progress": 15,
  "started_at": "2024-06-28T14:30:00Z",
  "estimated_completion": "2024-06-28T14:45:00Z",
  "analysis_type": "comprehensive",
  "webhook_configured": true
}`
              })}
            </div>
          </div>
        )

      case 'transformation-api':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Transformation API</h1>
              <p className="text-sm text-gray-600">
                Apply intelligent data transformations, cleaning, and formatting operations to prepare ML-ready datasets.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Endpoints</h2>
                <div className="space-y-4">
                  {apiEndpoints['transformation-api']?.map((endpoint, index) => (
                    <div key={index}>
                      {renderAPIEndpoint(endpoint)}
                    </div>
                  ))}
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Smart Data Transformations',
                description: 'Apply AI-suggested transformations with custom rules and validation',
                code: `import pollarbase

client = pollarbase.Client()
dataset = client.get_dataset("ds_7Qj2mK8fN3xB")

# Define transformation pipeline
transformations = [
    {
        "type": "missing_value_imputation",
        "column": "age",
        "method": "median",
        "group_by": ["customer_segment"]
    },
    {
        "type": "outlier_treatment",
        "columns": ["purchase_amount"],
        "method": "winsorize",
        "percentiles": [0.05, 0.95]
    },
    {
        "type": "categorical_encoding",
        "column": "product_category",
        "method": "target_encoding",
        "target": "purchase_amount"
    },
    {
        "type": "date_standardization",
        "columns": ["created_at", "updated_at"],
        "target_format": "ISO8601",
        "timezone": "UTC"
    },
    {
        "type": "text_cleaning",
        "columns": ["customer_name", "address"],
        "operations": ["trim", "title_case", "remove_special_chars"]
    }
]

# Apply transformations with validation
result = dataset.apply_transformations(
    transformations,
    validate_schema=True,
    backup_original=True,
    dry_run=False
)

print(f"Transformation Status: {result.status}")
print(f"Rows processed: {result.rows_processed}")
print(f"Quality improvement: +{result.quality_improvement}%")

# Review transformation results
for transform in result.applied_transformations:
    print(f"\\n{transform.type}:")
    print(f"  Column(s): {', '.join(transform.columns)}")
    print(f"  Rows affected: {transform.rows_affected}")
    print(f"  Quality impact: +{transform.quality_impact}%")
    if transform.warnings:
        print(f"  Warnings: {', '.join(transform.warnings)}")`,
                response: `Transformation Status: completed
Rows processed: 10000
Quality improvement: +12%

missing_value_imputation:
  Column(s): age
  Rows affected: 156
  Quality impact: +8%

outlier_treatment:
  Column(s): purchase_amount
  Rows affected: 12
  Quality impact: +3%

categorical_encoding:
  Column(s): product_category
  Rows affected: 10000
  Quality impact: +15%

date_standardization:
  Column(s): created_at, updated_at
  Rows affected: 23
  Quality impact: +2%

text_cleaning:
  Column(s): customer_name, address
  Rows affected: 847
  Quality impact: +5%`
              })}
            </div>
          </div>
        )

      case 'export-api':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Export API</h1>
              <p className="text-sm text-gray-600">
                Export processed datasets in various formats optimized for different use cases and ML frameworks.
              </p>
            </div>

            <div className="space-y-8">
              {renderCodeBlock({
                language: 'python',
                title: 'Multi-Format Export',
                description: 'Export data in multiple formats with custom configurations',
                code: `import pollarbase

client = pollarbase.Client()
dataset = client.get_dataset("ds_7Qj2mK8fN3xB")

# Configure export options
export_configs = [
    {
        "format": "csv",
        "filename": "clean_customer_data.csv",
        "options": {
            "encoding": "utf-8",
            "delimiter": ",",
            "include_index": False,
            "compression": "gzip"
        }
    },
    {
        "format": "parquet",
        "filename": "customer_data_optimized.parquet",
        "options": {
            "compression": "snappy",
            "row_group_size": 50000
        }
    },
    {
        "format": "tensorflow",
        "split_config": {
            "train": 0.7,
            "validation": 0.15,
            "test": 0.15
        },
        "options": {
            "target_column": "purchase_amount",
            "feature_scaling": "standard",
            "categorical_encoding": "one_hot"
        }
    },
    {
        "format": "pytorch",
        "filename": "dataset_pytorch.pt",
        "options": {
            "tensor_type": "float32",
            "device": "cpu"
        }
    }
]

# Batch export
export_results = dataset.export_batch(export_configs)

print("Export Results:")
for result in export_results:
    print(f"  {result.format}: {result.filename}")
    print(f"    Size: {result.file_size_mb:.1f} MB")
    print(f"    Rows: {result.row_count:,}")
    print(f"    Download URL: {result.download_url}")
    print()`,
                response: `Export Results:
  csv: clean_customer_data.csv.gz
    Size: 2.4 MB
    Rows: 10,000
    Download URL: https://api.pollarbase.com/v1/downloads/exp_8Xm4...

  parquet: customer_data_optimized.parquet
    Size: 1.8 MB
    Rows: 10,000
    Download URL: https://api.pollarbase.com/v1/downloads/exp_9Yn5...

  tensorflow: 
    Size: 3.2 MB (train: 7000, val: 1500, test: 1500)
    Rows: 10,000
    Download URL: https://api.pollarbase.com/v1/downloads/exp_0Zo6...

  pytorch: dataset_pytorch.pt
    Size: 2.1 MB
    Rows: 10,000
    Download URL: https://api.pollarbase.com/v1/downloads/exp_1Ap7...`
              })}
            </div>
          </div>
        )

      case 'jobs-api':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Jobs API</h1>
              <p className="text-sm text-gray-600">
                Monitor and manage long-running data processing jobs with real-time status updates and progress tracking.
              </p>
            </div>

            <div className="space-y-8">
              {renderCodeBlock({
                language: 'python',
                title: 'Job Management and Monitoring',
                description: 'Track job progress, handle failures, and manage job queues',
                code: `import pollarbase
import time

client = pollarbase.Client()

# Start multiple jobs
jobs = []
datasets = ["ds_1", "ds_2", "ds_3", "ds_4", "ds_5"]

for dataset_id in datasets:
    job = client.start_analysis_job(
        dataset_id=dataset_id,
        priority="high",
        webhook_url="https://myapp.com/webhook"
    )
    jobs.append(job)
    print(f"Started job {job.id} for dataset {dataset_id}")

# Monitor job progress
def monitor_jobs(job_ids, timeout=600):
    start_time = time.time()
    completed = []
    failed = []
    
    while len(completed) + len(failed) < len(job_ids):
        if time.time() - start_time > timeout:
            print("Timeout reached!")
            break
            
        for job_id in job_ids:
            if job_id in completed or job_id in failed:
                continue
                
            job_status = client.get_job_status(job_id)
            
            if job_status.status == "completed":
                completed.append(job_id)
                print(f"✅ Job {job_id} completed ({job_status.duration}s)")
                
            elif job_status.status == "failed":
                failed.append(job_id)
                print(f"❌ Job {job_id} failed: {job_status.error_message}")
                
            elif job_status.status == "running":
                print(f"🔄 Job {job_id}: {job_status.progress}% complete")
        
        time.sleep(10)  # Check every 10 seconds
    
    return completed, failed

# Monitor all jobs
job_ids = [job.id for job in jobs]
completed, failed = monitor_jobs(job_ids)

print(f"\\nSummary:")
print(f"Completed: {len(completed)}")
print(f"Failed: {len(failed)}")

# Handle failed jobs
if failed:
    print("\\nRetrying failed jobs...")
    for job_id in failed:
        # Get failure details
        job_details = client.get_job_details(job_id)
        
        if job_details.retry_count < 3:
            # Retry with exponential backoff
            new_job = client.retry_job(job_id)
            print(f"Retrying job {job_id} as {new_job.id}")
        else:
            print(f"Job {job_id} exceeded retry limit")`,
                response: `Started job job_8Xm4nL9gO4yC for dataset ds_1
Started job job_9Yn5oM0hP5zD for dataset ds_2
Started job job_0Zo6pN1iQ6aE for dataset ds_3
Started job job_1Ap7qO2jR7bF for dataset ds_4
Started job job_2Bq8rP3kS8cG for dataset ds_5

🔄 Job job_8Xm4nL9gO4yC: 25% complete
🔄 Job job_9Yn5oM0hP5zD: 15% complete
🔄 Job job_0Zo6pN1iQ6aE: 30% complete
🔄 Job job_1Ap7qO2jR7bF: 45% complete
🔄 Job job_2Bq8rP3kS8cG: 20% complete

✅ Job job_1Ap7qO2jR7bF completed (45s)
🔄 Job job_8Xm4nL9gO4yC: 75% complete
❌ Job job_2Bq8rP3kS8cG failed: Memory limit exceeded
✅ Job job_8Xm4nL9gO4yC completed (78s)
✅ Job job_9Yn5oM0hP5zD completed (82s)
✅ Job job_0Zo6pN1iQ6aE completed (91s)

Summary:
Completed: 4
Failed: 1

Retrying failed jobs...
Retrying job job_2Bq8rP3kS8cG as job_3Cr9sQ4lT9dH`
              })}
            </div>
          </div>
        )

      case 'performance-scaling':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Performance & Scaling</h1>
              <p className="text-sm text-gray-600">
                Comprehensive guide to optimizing performance, understanding limits, and scaling your data processing workloads.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Performance Benchmarks</h2>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900 mb-2">Small Files (1MB - 100MB)</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Processing: 2-15 seconds</div>
                        <div>Memory: 50-200MB</div>
                        <div>Throughput: 50-100 files/min</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900 mb-2">Medium Files (100MB - 5GB)</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Processing: 30s - 10min</div>
                        <div>Memory: 500MB - 2GB</div>
                        <div>Throughput: 10-30 files/min</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900 mb-2">Large Files (5GB+)</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Processing: 10-60min</div>
                        <div>Memory: 2-8GB</div>
                        <div>Throughput: 1-5 files/min</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Performance Optimization Configuration',
                description: 'Configure processing parameters for optimal performance based on your data characteristics',
                code: `import pollarbase

client = pollarbase.Client()

# Configure for high-throughput processing
high_throughput_config = {
    'processing_mode': 'parallel',
    'max_workers': 8,
    'chunk_size': 10000,  # rows per chunk
    'memory_limit': '4GB',
    'enable_compression': True,
    'async_processing': True
}

# Configure for memory-constrained environments
low_memory_config = {
    'processing_mode': 'streaming',
    'chunk_size': 1000,
    'memory_limit': '512MB',
    'enable_disk_cache': True,
    'compression_level': 9
}

# Configure for maximum accuracy (slower)
high_accuracy_config = {
    'processing_mode': 'comprehensive',
    'enable_deep_analysis': True,
    'anomaly_detection_sensitivity': 'high',
    'quality_checks': 'thorough',
    'ml_inference_depth': 'deep'
}

# Apply configuration to upload
dataset = client.upload_file(
    "large_dataset.csv",
    config=high_throughput_config,
    progress_callback=lambda p: print(f"Progress: {p}%")
)

# Monitor resource usage
stats = client.get_processing_stats(dataset.id)
print(f"CPU Usage: {stats.cpu_percent}%")
print(f"Memory Usage: {stats.memory_mb}MB")
print(f"Processing Speed: {stats.rows_per_second}/sec")`,
                response: `Progress: 10%
Progress: 25%
Progress: 50%
Progress: 75%
Progress: 100%
CPU Usage: 65%
Memory Usage: 2048MB
Processing Speed: 15000/sec`
              })}

              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Scaling Strategies</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="font-semibold text-gray-900 mb-3">Horizontal Scaling</h3>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li>Process multiple files concurrently</li>
                      <li>Use batch processing for large datasets</li>
                      <li>Implement queue-based processing</li>
                      <li>Distribute processing across regions</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="font-semibold text-gray-900 mb-3">Vertical Scaling</h3>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li>Increase memory allocation per job</li>
                      <li>Use faster storage (SSD vs HDD)</li>
                      <li>Optimize chunk sizes for your data</li>
                      <li>Enable compression and caching</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'pipeline-architecture':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Pipeline Architecture</h1>
              <p className="text-sm text-gray-600">
                Design robust, scalable data pipelines for production environments with best practices and architectural patterns.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Architecture Patterns</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <h3 className="font-semibold text-blue-900 mb-3">Batch Processing Pipeline</h3>
                    <div className="text-sm text-blue-800 space-y-2">
                      <div>Data Ingestion → Validation → Processing → Quality Check → Export</div>
                      <div className="text-xs">Best for: Large datasets, scheduled processing, cost optimization</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                    <h3 className="font-semibold text-green-900 mb-3">Streaming Pipeline</h3>
                    <div className="text-sm text-green-800 space-y-2">
                      <div>Stream Ingestion → Real-time Processing → Continuous Validation → Live Export</div>
                      <div className="text-xs">Best for: Real-time analytics, event-driven processing</div>
                    </div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Apache Airflow Integration',
                description: 'Complete Airflow DAG for automated data processing pipeline',
                code: `from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from datetime import datetime, timedelta
import pollarbase

# DAG configuration
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'retries': 3,
    'retry_delay': timedelta(minutes=5)
}

dag = DAG(
    'pollarbase_data_pipeline',
    default_args=default_args,
    description='Automated data processing with Pollarbase',
    schedule_interval='0 2 * * *',  # Daily at 2 AM
    catchup=False
)

def process_with_pollarbase(**context):
    """Process data using Pollarbase API"""
    client = pollarbase.Client()
    
    files = [
        "/data/daily_sales.csv",
        "/data/customer_updates.csv",
        "/data/inventory_changes.csv"
    ]
    
    processed_datasets = []
    
    for file_path in files:
        # Upload and process
        dataset = client.upload_file(
            file_path,
            auto_analyze=True,
            quality_threshold=0.8,
            detect_anomalies=True
        )
        
        # Wait for processing
        analysis = dataset.wait_for_analysis(timeout=300)
        
        if analysis.quality_score < 0.8:
            # Apply auto-fixes for low quality data
            suggestions = analysis.get_suggestions()
            high_confidence_fixes = [s for s in suggestions if s.confidence > 0.9]
            dataset = dataset.apply_transformations(high_confidence_fixes)
        
        # Export cleaned data
        export_result = dataset.export({
            'format': 'parquet',
            'path': f"/processed/{dataset.name}",
            'compression': 'snappy'
        })
        
        processed_datasets.append({
            'dataset_id': dataset.id,
            'quality_score': analysis.quality_score,
            'export_path': export_result.path
        })
    
    return processed_datasets

# Define tasks
process_task = PythonOperator(
    task_id='process_data',
    python_callable=process_with_pollarbase,
    dag=dag
)`,
                response: `DAG Successfully Created: pollarbase_data_pipeline
Next Run: 2024-01-02 02:00:00
Tasks: process_data scheduled successfully`
              })}
            </div>
          </div>
        )

      case 'ml-integration':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">ML Framework Integration</h1>
              <p className="text-sm text-gray-600">
                Seamlessly integrate Pollarbase with popular machine learning frameworks and data science tools.
              </p>
            </div>

            <div className="space-y-8">
              {renderCodeBlock({
                language: 'python',
                title: 'Pandas DataFrame Integration',
                description: 'Direct integration with pandas for seamless data analysis workflows',
                code: `import pollarbase
import pandas as pd

client = pollarbase.Client()

# Upload and get processed DataFrame directly
dataset = client.upload_file("customer_data.csv")
analysis = dataset.analyze()

# Get cleaned DataFrame
df = dataset.to_pandas(
    apply_transformations=True,
    remove_anomalies=True,
    quality_threshold=0.85
)

print(f"Original shape: {dataset.shape}")
print(f"Cleaned shape: {df.shape}")
print(f"Quality improvement: +{analysis.quality_improvement}%")

# Pollarbase enhances your DataFrame with metadata
print(f"Column types detected: {df.pollarbase.column_types}")
print(f"Quality scores: {df.pollarbase.quality_scores}")
print(f"Suggested transformations: {df.pollarbase.suggestions}")

# Use enhanced DataFrame for analysis
correlation_matrix = df.select_dtypes(include=['number']).corr()
print("Correlation Matrix:")
print(correlation_matrix)

# Export for further processing
df.to_parquet("cleaned_customer_data.parquet")`,
                response: `Original shape: (10000, 12)
Cleaned shape: (9847, 12)
Quality improvement: +23%
Column types detected: {'customer_id': 'categorical', 'age': 'numeric', 'email': 'email'}
Quality scores: {'customer_id': 0.98, 'age': 0.73, 'email': 0.92}
Suggested transformations: ['fill_missing_age', 'standardize_email_format']`
              })}

              {renderCodeBlock({
                language: 'python',
                title: 'Scikit-learn Pipeline Integration',
                description: 'Integrate data processing directly into scikit-learn pipelines',
                code: `import pollarbase
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Custom Pollarbase transformer for sklearn
class PollarbaseTransformer:
    def __init__(self, quality_threshold=0.8):
        self.client = pollarbase.Client()
        self.quality_threshold = quality_threshold
        self.dataset = None
        
    def fit(self, X, y=None):
        return self
    
    def transform(self, X):
        # Process with Pollarbase if it's raw data
        if isinstance(X, str):  # File path
            self.dataset = self.client.upload_file(X)
            analysis = self.dataset.analyze()
            
            if analysis.quality_score < self.quality_threshold:
                # Apply transformations
                suggestions = analysis.get_suggestions()
                self.dataset = self.dataset.apply_transformations(suggestions)
            
            return self.dataset.to_numpy()
        return X

# Create ML pipeline with Pollarbase preprocessing
pipeline = Pipeline([
    ('pollarbase_processor', PollarbaseTransformer(quality_threshold=0.85)),
    ('scaler', StandardScaler()),
    ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
])

# Train model with automatic data cleaning
X_train = "train_data.csv"  # Pollarbase will process this
y_train = pd.read_csv("train_labels.csv")['target']

# Fit pipeline (includes data cleaning)
pipeline.fit(X_train, y_train)

# Predict on new data
X_test = "test_data.csv"
predictions = pipeline.predict(X_test)

print("Model trained with Pollarbase-processed data")
print(f"Training completed successfully")`,
                response: `Model trained with Pollarbase-processed data
Training completed successfully
Data quality score: 0.89
Applied transformations: 4
Processing time: 45.3s`
              })}

              {renderCodeBlock({
                language: 'python',
                title: 'TensorFlow Dataset Integration',
                description: 'Create TensorFlow datasets directly from Pollarbase processed data',
                code: `import pollarbase
import tensorflow as tf
import numpy as np

client = pollarbase.Client()

# Process data and create TensorFlow dataset
dataset = client.upload_file("training_data.csv")
analysis = dataset.analyze()

# Export as TensorFlow-ready format
tf_export = dataset.export_tensorflow(
    target_column='label',
    batch_size=32,
    validation_split=0.2,
    test_split=0.1,
    feature_scaling='standard',
    shuffle=True
)

# Get TensorFlow datasets
train_ds = tf_export.train_dataset
val_ds = tf_export.validation_dataset  
test_ds = tf_export.test_dataset

print(f"Training samples: {tf_export.train_samples}")
print(f"Validation samples: {tf_export.validation_samples}")
print(f"Test samples: {tf_export.test_samples}")
print(f"Feature shape: {tf_export.feature_shape}")

# Create model
model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation='relu', input_shape=tf_export.feature_shape),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dense(tf_export.num_classes, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# Train model
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=10,
    verbose=1
)

# Evaluate
test_loss, test_accuracy = model.evaluate(test_ds)
print(f"Test accuracy: {test_accuracy:.4f}")`,
                response: `Training samples: 7000
Validation samples: 2000
Test samples: 1000
Feature shape: (15,)
Epoch 1/10: loss: 0.8421 - accuracy: 0.7234 - val_loss: 0.6543 - val_accuracy: 0.7890
...
Epoch 10/10: loss: 0.2134 - accuracy: 0.9234 - val_loss: 0.3456 - val_accuracy: 0.8790
Test accuracy: 0.8823`
              })}
            </div>
          </div>
        )

      case 'error-handling':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Error Handling & Recovery</h1>
              <p className="text-sm text-gray-600">
                Robust error handling strategies, retry mechanisms, and recovery patterns for production data pipelines.
              </p>
            </div>

            <div className="space-y-8">
              {renderCodeBlock({
                language: 'python',
                title: 'Comprehensive Error Handling',
                description: 'Handle different types of errors with appropriate recovery strategies',
                code: `import pollarbase
import time
import logging
from functools import wraps
from pollarbase.exceptions import (
    APIError, 
    RateLimitError, 
    ValidationError,
    ProcessingError,
    QualityError
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def retry_with_exponential_backoff(max_retries=3, base_delay=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except RateLimitError as e:
                    if attempt == max_retries - 1:
                        raise
                    delay = min(e.retry_after or base_delay * (2 ** attempt), 300)
                    logger.warning(f"Rate limited, retrying in {delay}s")
                    time.sleep(delay)
                except (APIError, ProcessingError) as e:
                    if attempt == max_retries - 1:
                        raise
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"API error, retrying in {delay}s: {str(e)}")
                    time.sleep(delay)
            return None
        return wrapper
    return decorator

class RobustDataProcessor:
    def __init__(self):
        self.client = pollarbase.Client()
        self.failed_files = []
        self.processed_files = []
        
    @retry_with_exponential_backoff(max_retries=3)
    def process_file_safely(self, file_path, **kwargs):
        """Process a single file with comprehensive error handling"""
        try:
            # Validate file before upload
            if not self._validate_file(file_path):
                raise ValidationError(f"File validation failed: {file_path}")
            
            # Upload with timeout
            dataset = self.client.upload_file(
                file_path,
                timeout=600,  # 10 minute timeout
                **kwargs
            )
            
            # Monitor processing with timeout
            analysis = self._wait_for_analysis_with_timeout(
                dataset, 
                timeout=900  # 15 minute timeout
            )
            
            return {
                'dataset_id': dataset.id,
                'file_path': file_path,
                'quality_score': analysis.quality_score,
                'status': 'success'
            }
            
        except ValidationError as e:
            logger.error(f"Validation error for {file_path}: {str(e)}")
            self.failed_files.append({
                'file_path': file_path,
                'error_type': 'validation',
                'error_message': str(e),
                'recoverable': False
            })
            raise
            
        except Exception as e:
            logger.error(f"Unexpected error for {file_path}: {str(e)}")
            self.failed_files.append({
                'file_path': file_path,
                'error_type': 'unexpected',
                'error_message': str(e),
                'recoverable': True
            })
            raise

# Usage example
processor = RobustDataProcessor()
batch_result = processor.process_batch_with_recovery(
    ["data/sales_2023_q1.csv", "data/sales_2023_q2.csv"],
    quality_threshold=0.8,
    auto_analyze=True
)
print(f"Processing complete: {batch_result['summary']}")`,
                response: `Processing complete: {'total': 2, 'successful': 2, 'failed': 0, 'success_rate': 1.0}
Failed files can be retried with different parameters
Recoverable errors: 0
Non-recoverable errors: 0`
              })}
            </div>
          </div>
        )

      case 'data-governance':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Data Governance</h1>
              <p className="text-sm text-gray-600">
                Comprehensive data governance framework including lineage tracking, compliance, and PII protection.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Data Lineage & Audit Trail</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-3">Automatic Lineage Tracking</h3>
                  <p className="text-blue-800 text-sm mb-4">
                    Every data transformation is automatically tracked with complete lineage from source to output,
                    including transformations, quality checks, and access patterns.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white/70 rounded-md p-3">
                      <h4 className="font-medium text-blue-900 text-sm">Source Tracking</h4>
                      <p className="text-xs text-blue-700">File origins, upload timestamps, user attribution</p>
                    </div>
                    <div className="bg-white/70 rounded-md p-3">
                      <h4 className="font-medium text-blue-900 text-sm">Transformation Log</h4>
                      <p className="text-xs text-blue-700">Applied rules, quality fixes, column mappings</p>
                    </div>
                    <div className="bg-white/70 rounded-md p-3">
                      <h4 className="font-medium text-blue-900 text-sm">Access Audit</h4>
                      <p className="text-xs text-blue-700">Who accessed what data when and how</p>
                    </div>
                  </div>
                </div>
              </div>

              {renderCodeBlock({
                language: 'python',
                title: 'Data Lineage API Usage',
                description: 'Track and query data lineage for compliance and debugging',
                code: `import pollarbase

client = pollarbase.Client()

# Upload with governance metadata
dataset = client.upload_file(
    "customer_data.csv",
    governance_metadata={
        'data_classification': 'PII',
        'business_purpose': 'Customer Analytics',
        'retention_period': '7_years',
        'compliance_tags': ['GDPR', 'CCPA'],
        'data_owner': 'data-team@company.com',
        'department': 'Marketing'
    }
)

# Get complete lineage
lineage = dataset.get_lineage()
print(f"Source: {lineage.source_file}")
print(f"Upload time: {lineage.created_at}")
print(f"Uploaded by: {lineage.uploaded_by}")
print(f"Processing steps: {len(lineage.transformations)}")

# Trace transformations
for i, transformation in enumerate(lineage.transformations):
    print(f"Step {i+1}: {transformation.type}")
    print(f"  Applied at: {transformation.timestamp}")
    print(f"  Confidence: {transformation.confidence}")
    print(f"  Affected columns: {transformation.columns}")
    print(f"  Before/after rows: {transformation.rows_before} -> {transformation.rows_after}")

# Query data access history
access_log = dataset.get_access_history(
    start_date='2024-01-01',
    end_date='2024-12-31'
)

print(f"Total access events: {len(access_log.events)}")
for event in access_log.events[-5:]:  # Last 5 accesses
    print(f"User: {event.user_id}")
    print(f"Action: {event.action}")
    print(f"Timestamp: {event.timestamp}")
    print(f"IP Address: {event.ip_address}")
    print(f"Access method: {event.method}")

# Export lineage for compliance
lineage_report = dataset.export_lineage_report(
    format='json',
    include_transformations=True,
    include_access_log=True,
    include_quality_metrics=True
)

print(f"Lineage report exported: {lineage_report.file_path}")`,
                response: `Source: customer_data.csv
Upload time: 2024-01-15T10:30:00Z
Uploaded by: john.doe@company.com
Processing steps: 4

Step 1: missing_value_imputation
  Applied at: 2024-01-15T10:31:15Z
  Confidence: 0.95
  Affected columns: ['age', 'income']
  Before/after rows: 10000 -> 10000

Step 2: outlier_detection
  Applied at: 2024-01-15T10:32:45Z
  Confidence: 0.89
  Affected columns: ['purchase_amount']
  Before/after rows: 10000 -> 9847

Total access events: 156
User: analytics@company.com
Action: export_data
Timestamp: 2024-01-20T14:22:00Z
IP Address: 192.168.1.100
Access method: API

Lineage report exported: lineage_customer_data_20240120.json`
              })}

              {renderCodeBlock({
                language: 'python',
                title: 'PII Detection and Protection',
                description: 'Automatically detect and protect personally identifiable information',
                code: `import pollarbase
from pollarbase.governance import PIIProtection

client = pollarbase.Client()

# Configure PII protection
pii_config = PIIProtection.Config(
    detection_sensitivity='high',
    auto_mask_pii=True,
    compliance_standards=['GDPR', 'CCPA', 'HIPAA'],
    allowed_pii_columns=['customer_id'],  # Explicitly allowed
    masking_strategy='tokenization'  # or 'hashing', 'encryption'
)

# Upload with PII protection
dataset = client.upload_file(
    "customer_database.csv",
    pii_protection=pii_config,
    compliance_mode=True
)

# Get PII detection results
pii_report = dataset.get_pii_report()
print(f"PII columns detected: {len(pii_report.pii_columns)}")

for column, details in pii_report.pii_columns.items():
    print(f"Column: {column}")
    print(f"  PII Type: {details.pii_type}")
    print(f"  Confidence: {details.confidence:.2%}")
    print(f"  Sample values: {details.sample_masked}")
    print(f"  Protection applied: {details.protection_method}")
    print(f"  Compliance impact: {details.compliance_notes}")

# Handle PII consent and access requests
# GDPR Article 15 - Right of Access
def handle_data_subject_request(email):
    # Find all datasets containing this email
    datasets_with_email = client.governance.find_datasets_containing_pii(
        pii_value=email,
        pii_type='email'
    )
    
    access_report = []
    for dataset in datasets_with_email:
        lineage = dataset.get_lineage()
        access_log = dataset.get_access_history()
        
        access_report.append({
            'dataset_id': dataset.id,
            'data_collected': lineage.created_at,
            'legal_basis': dataset.metadata.get('legal_basis'),
            'processing_purpose': dataset.metadata.get('business_purpose'),
            'retention_period': dataset.metadata.get('retention_period'),
            'access_count': len(access_log.events),
            'last_accessed': access_log.events[-1].timestamp if access_log.events else None
        })
    
    return access_report

# GDPR Article 17 - Right to Erasure
def handle_erasure_request(email):
    datasets = client.governance.find_datasets_containing_pii(
        pii_value=email,
        pii_type='email'
    )
    
    erasure_results = []
    for dataset in datasets:
        # Check if erasure is legally required
        if dataset.can_be_erased(legal_basis_check=True):
            result = dataset.erase_pii_data(
                pii_value=email,
                verification_required=True
            )
            erasure_results.append(result)
        else:
            print(f"Dataset {dataset.id} cannot be erased: legal obligation")
    
    return erasure_results

# Example usage
email_to_find = "customer@example.com"
access_report = handle_data_subject_request(email_to_find)
print(f"Found email in {len(access_report)} datasets")`,
                response: `PII columns detected: 6
Column: email
  PII Type: email_address
  Confidence: 99.8%
  Sample values: ['j***@***.com', 'm***@***.org']
  Protection applied: tokenization
  Compliance impact: GDPR Article 4 - requires consent tracking

Column: phone_number
  PII Type: phone
  Confidence: 95.2%
  Sample values: ['***-***-1234', '***-***-5678']
  Protection applied: masking
  Compliance impact: CCPA - California resident detection required

Found email in 3 datasets
All datasets compliant with retention policies`
              })}
            </div>
          </div>
        )

      case 'observability':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Monitoring & Observability</h1>
              <p className="text-sm text-gray-600">
                Comprehensive monitoring, alerting, and observability for production data pipelines.
              </p>
            </div>

            <div className="space-y-8">
              {renderCodeBlock({
                language: 'python',
                title: 'Production Monitoring Setup',
                description: 'Set up comprehensive monitoring for data pipelines with custom metrics and alerts',
                code: `import pollarbase
from pollarbase.monitoring import MetricsCollector, AlertManager
import prometheus_client
import time

# Initialize monitoring components
client = pollarbase.Client()
metrics = MetricsCollector()
alerts = AlertManager()

# Define custom metrics
processing_duration = prometheus_client.Histogram(
    'pollarbase_processing_duration_seconds',
    'Time spent processing datasets',
    ['dataset_type', 'processing_mode']
)

quality_score_gauge = prometheus_client.Gauge(
    'pollarbase_quality_score',
    'Data quality score for processed datasets',
    ['dataset_id', 'data_source']
)

error_counter = prometheus_client.Counter(
    'pollarbase_processing_errors_total',
    'Total processing errors',
    ['error_type', 'dataset_type']
)

class ProductionDataProcessor:
    def __init__(self):
        self.client = pollarbase.Client()
        self.setup_alerts()
    
    def setup_alerts(self):
        """Configure monitoring alerts"""
        # Quality degradation alert
        alerts.add_alert(
            name='quality_degradation',
            condition='quality_score < 0.8',
            severity='warning',
            notification_channels=['slack', 'email'],
            message='Data quality below threshold: {quality_score}'
        )
        
        # Processing time alert
        alerts.add_alert(
            name='slow_processing',
            condition='processing_duration > 600',  # 10 minutes
            severity='warning',
            notification_channels=['slack'],
            message='Processing taking longer than expected: {duration}s'
        )
        
        # Error rate alert
        alerts.add_alert(
            name='high_error_rate',
            condition='error_rate > 0.05',  # 5% error rate
            severity='critical',
            notification_channels=['pagerduty', 'slack', 'email'],
            message='High error rate detected: {error_rate:.2%}'
        )
    
    def process_with_monitoring(self, file_path, **kwargs):
        """Process file with comprehensive monitoring"""
        dataset_type = kwargs.get('dataset_type', 'unknown')
        processing_mode = kwargs.get('processing_mode', 'standard')
        
        # Start timing
        start_time = time.time()
        
        try:
            # Process the file
            dataset = self.client.upload_file(file_path, **kwargs)
            analysis = dataset.analyze()
            
            # Record metrics
            processing_time = time.time() - start_time
            processing_duration.labels(
                dataset_type=dataset_type,
                processing_mode=processing_mode
            ).observe(processing_time)
            
            quality_score_gauge.labels(
                dataset_id=dataset.id,
                data_source=file_path
            ).set(analysis.quality_score)
            
            # Custom business metrics
            metrics.record_custom_metric(
                'data_volume_processed',
                dataset.size_bytes,
                tags={
                    'dataset_type': dataset_type,
                    'file_format': dataset.file_format
                }
            )
            
            # Check alerts
            alerts.check_conditions({
                'quality_score': analysis.quality_score,
                'processing_duration': processing_time,
                'dataset_id': dataset.id
            })
            
            # Log structured event
            metrics.log_event(
                event_type='dataset_processed',
                dataset_id=dataset.id,
                quality_score=analysis.quality_score,
                processing_time=processing_time,
                rows_processed=dataset.row_count,
                columns_processed=dataset.column_count
            )
            
            return {
                'dataset_id': dataset.id,
                'quality_score': analysis.quality_score,
                'processing_time': processing_time,
                'status': 'success'
            }
            
        except Exception as e:
            # Record error metrics
            error_counter.labels(
                error_type=type(e).__name__,
                dataset_type=dataset_type
            ).inc()
            
            # Log error event
            metrics.log_event(
                event_type='processing_error',
                error_type=type(e).__name__,
                error_message=str(e),
                file_path=file_path,
                processing_time=time.time() - start_time
            )
            
            # Trigger error alert
            alerts.trigger_alert(
                'processing_error',
                {
                    'error_type': type(e).__name__,
                    'file_path': file_path,
                    'error_message': str(e)
                }
            )
            
            raise

# Usage with monitoring
processor = ProductionDataProcessor()

# Process files with monitoring
files = ["daily_sales.csv", "customer_data.csv", "inventory.csv"]
for file_path in files:
    try:
        result = processor.process_with_monitoring(
            file_path,
            dataset_type='sales_data',
            processing_mode='production'
        )
        print(f"Processed {file_path}: Quality {result['quality_score']:.2f}")
    except Exception as e:
        print(f"Failed to process {file_path}: {str(e)}")

# Export metrics for external monitoring systems
metrics_export = metrics.export_prometheus_metrics()
print(f"Metrics exported: {len(metrics_export)} metrics")`,
                response: `Processed daily_sales.csv: Quality 0.89
Processed customer_data.csv: Quality 0.94
Alert triggered: quality_degradation for inventory.csv (score: 0.76)
Failed to process corrupted_file.csv: ValidationError

Metrics exported: 15 metrics
Alerts configured: 3 active
Monitoring dashboard available at: http://monitoring.company.com/pollarbase`
              })}

              {renderCodeBlock({
                language: 'python',
                title: 'Dashboard and Visualization Integration',
                description: 'Integrate with popular monitoring tools like Grafana and DataDog',
                code: `import pollarbase
from pollarbase.integrations import GrafanaIntegration, DataDogIntegration
import json

# Grafana Integration
grafana = GrafanaIntegration(
    url='https://grafana.company.com',
    api_key='your_grafana_api_key'
)

# Create Pollarbase monitoring dashboard
dashboard_config = {
    'title': 'Pollarbase Data Pipeline Monitoring',
    'panels': [
        {
            'title': 'Processing Volume',
            'type': 'graph',
            'metrics': ['pollarbase_files_processed_total'],
            'time_range': '24h'
        },
        {
            'title': 'Quality Score Distribution',
            'type': 'histogram',
            'metrics': ['pollarbase_quality_score'],
            'time_range': '7d'
        },
        {
            'title': 'Error Rate',
            'type': 'stat',
            'metrics': ['pollarbase_processing_errors_total'],
            'alert_threshold': 0.05
        },
        {
            'title': 'Processing Duration',
            'type': 'heatmap',
            'metrics': ['pollarbase_processing_duration_seconds'],
            'time_range': '24h'
        }
    ],
    'alerts': [
        {
            'name': 'High Error Rate',
            'condition': 'avg(pollarbase_error_rate) > 0.05',
            'notification_channels': ['slack-alerts']
        }
    ]
}

# Deploy dashboard
dashboard = grafana.create_dashboard(dashboard_config)
print(f"Dashboard created: {dashboard.url}")

# DataDog Integration
datadog = DataDogIntegration(
    api_key='your_datadog_api_key',
    app_key='your_datadog_app_key'
)

# Send custom metrics to DataDog
client = pollarbase.Client()

def send_pipeline_metrics():
    """Send pipeline health metrics to DataDog"""
    
    # Get pipeline statistics
    stats = client.get_pipeline_stats(timeframe='1h')
    
    # Send metrics
    datadog.send_metrics([
        {
            'metric': 'pollarbase.files.processed',
            'points': [(int(time.time()), stats.files_processed)],
            'tags': ['environment:production', 'team:data']
        },
        {
            'metric': 'pollarbase.quality.average',
            'points': [(int(time.time()), stats.avg_quality_score)],
            'tags': ['environment:production']
        },
        {
            'metric': 'pollarbase.processing.duration',
            'points': [(int(time.time()), stats.avg_processing_time)],
            'tags': ['environment:production']
        }
    ])
    
    # Send service check
    datadog.send_service_check(
        check='pollarbase.pipeline.health',
        status=0 if stats.health_score > 0.9 else 1,
        tags=['environment:production']
    )

# Set up automated metrics reporting
import schedule

schedule.every(5).minutes.do(send_pipeline_metrics)

# Custom health check endpoint for load balancers
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/health')
def health_check():
    """Health check endpoint for monitoring systems"""
    try:
        # Check API connectivity
        client.health_check()
        
        # Check recent processing success rate
        stats = client.get_pipeline_stats(timeframe='15m')
        success_rate = stats.success_rate
        
        if success_rate > 0.95:
            status = 'healthy'
            code = 200
        elif success_rate > 0.85:
            status = 'degraded'
            code = 200
        else:
            status = 'unhealthy'
            code = 503
        
        return jsonify({
            'status': status,
            'success_rate': success_rate,
            'last_check': time.time(),
            'version': '2.1.0'
        }), code
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'last_check': time.time()
        }), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)`,
                response: `Dashboard created: https://grafana.company.com/d/pollarbase-monitoring
DataDog metrics sent successfully
Health check endpoint running on :8080
Service checks: 5/5 passing
Monitoring integration complete`
              })}
            </div>
          </div>
        )

      case 'cost-optimization':
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Cost Optimization</h1>
              <p className="text-sm text-gray-600">
                Strategies and techniques to optimize costs while maintaining performance and data quality.
              </p>
            </div>

            <div className="space-y-8">
              {renderCodeBlock({
                language: 'python',
                title: 'Cost-Aware Processing Configuration',
                description: 'Optimize processing costs based on data characteristics and requirements',
                code: `import pollarbase
from pollarbase.optimization import CostOptimizer

client = pollarbase.Client()
optimizer = CostOptimizer()

# Analyze historical cost patterns
cost_analysis = optimizer.analyze_historical_costs(
    timeframe='30d',
    group_by=['dataset_type', 'processing_mode', 'file_size']
)

print("Cost Analysis Summary:")
print("Total monthly cost: $" + str(cost_analysis.total_cost))
print("Average cost per GB: $" + str(cost_analysis.cost_per_gb))
print("Most expensive operation: " + cost_analysis.highest_cost_operation)

# Cost-optimized processing strategies
class CostOptimizedProcessor:
    def __init__(self):
        self.client = pollarbase.Client()
        self.optimizer = CostOptimizer()
    
    def choose_optimal_strategy(self, file_path, requirements):
        """Choose the most cost-effective processing strategy"""
        
        # Analyze file characteristics
        file_info = self.optimizer.analyze_file(file_path)
        
        strategies = [
            {
                'name': 'fast_processing',
                'cost_multiplier': 1.5,
                'time_savings': 0.7
            },
            {
                'name': 'standard_processing',
                'cost_multiplier': 1.0,
                'time_savings': 1.0
            },
            {
                'name': 'economical_processing',
                'cost_multiplier': 0.6,
                'time_savings': 1.8
            }
        ]
        
        # Find best strategy based on requirements
        best_strategy = strategies[1]  # Default to standard
        
        if requirements.get('urgent', False):
            best_strategy = strategies[0]  # Fast processing
        elif requirements.get('cost_sensitive', True):
            best_strategy = strategies[2]  # Economical processing
        
        return best_strategy
    
    def process_with_cost_optimization(self, file_path, requirements=None):
        """Process file with cost optimization"""
        requirements = requirements or {}
        
        # Choose optimal strategy
        strategy = self.choose_optimal_strategy(file_path, requirements)
        
        print("Selected strategy: " + strategy['name'])
        
        # Process with optimized configuration
        dataset = self.client.upload_file(file_path)
        
        return {
            'dataset_id': dataset.id,
            'strategy_used': strategy['name'],
            'cost_savings': 0.05
        }

# Usage example
processor = CostOptimizedProcessor()
result = processor.process_with_cost_optimization("data.csv")
print("Processing complete with cost savings!")`,
                response: `Cost Analysis Summary:
Total monthly cost: $1,234.56
Average cost per GB: $0.045
Most expensive operation: comprehensive_analysis_large_files

Selected strategy: standard_processing
Estimated cost: $0.234

Selected strategy: fast_processing
Estimated cost: $0.456

Selected strategy: economical_processing
Estimated cost: $0.123

Cost Optimization Results:
File 1: standard_processing
  Actual cost: $0.221
  Cost savings: $0.013
  Processing time: 45.2s

File 2: fast_processing
  Actual cost: $0.445
  Cost savings: $0.011
  Processing time: 23.1s

File 3: economical_processing
  Actual cost: $0.118
  Cost savings: $0.005
  Processing time: 78.4s`
              })}
            </div>
          </div>
        )

      default:
        return (
          <div className="max-w-4xl">
            <h1 className="text-xl font-bold text-gray-900 mb-3">
              {selectedSection.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Documentation for this section is coming soon.
            </p>
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Book className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                This section is currently being written. Check back soon!
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Custom styles for hiding scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: scrollbarHideStyles }} />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-8 lg:px-12">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <a href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
              </div>
                <span className="text-2xl font-bold text-gray-900">Pollarbase</span>
                <span className="text-lg text-gray-500 border-l border-gray-300 pl-4">Docs</span>
              </a>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-3 py-2 w-64 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <a href="/dashboard" 
                 className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium text-sm">
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Documentation Layout */}
      <div className="w-full px-8 lg:px-12 py-6">
        <div className="max-w-[1400px] mx-auto flex gap-8">
          {/* Left Sidebar - Navigation */}
          <aside className="w-72 shrink-0">
            <nav className="sticky top-28 space-y-4">
              {docsSections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => setSelectedSection(item.id)}
                          className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-left rounded-md transition-all duration-200 text-sm ${
                            selectedSection === item.id
                              ? 'bg-blue-50 text-blue-700 border-l-3 border-blue-500 shadow-sm font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                          }`}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main Content - Centered and Wider */}
          <main className="flex-1 min-w-0 max-w-4xl mx-auto px-3">
            {renderContent()}
          </main>

          {/* Right Sidebar - Table of Contents & Links */}
          <aside className="w-72 shrink-0">
            <div className="sticky top-28 space-y-4">
              {/* Table of Contents */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <List className="w-3 h-3" />
                  On This Page
                </h3>
                <nav className="space-y-1">
                  {selectedSection === 'introduction' && (
                    <>
                      <a href="#what-is-pollarbase" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">What is Pollarbase?</a>
                      <a href="#getting-started" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">Getting Started</a>
                      <a href="#features" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">Key Features</a>
                    </>
                  )}
                  {selectedSection === 'quickstart' && (
                    <>
                      <a href="#upload-dataset" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">Upload Dataset</a>
                      <a href="#python-workflow" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">Python Workflow</a>
                      <a href="#javascript-processing" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">JavaScript Processing</a>
                    </>
                  )}
                  {(selectedSection.endsWith('-api') || selectedSection === 'authentication') && (
                    <>
                      <a href="#endpoints" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">API Endpoints</a>
                      <a href="#parameters" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">Parameters</a>
                      <a href="#examples" className="block text-xs text-gray-600 hover:text-blue-600 transition-colors py-0.5">Code Examples</a>
                    </>
                  )}
                </nav>
              </div>

              {/* Recent Updates */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  What's New
                </h3>
                <div className="space-y-2">
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">v2.1.0 Released</div>
                    <div className="text-gray-600">Enhanced ML models</div>
                    <div className="text-gray-400">2 days ago</div>
                  </div>
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">New Python SDK</div>
                    <div className="text-gray-600">Async support added</div>
                    <div className="text-gray-400">1 week ago</div>
                  </div>
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">API Rate Limits</div>
                    <div className="text-gray-600">Increased to 1000/min</div>
                    <div className="text-gray-400">2 weeks ago</div>
                  </div>
                </div>
              </div>

              {/* Pro Tips */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 p-4">
                <h3 className="text-sm font-bold text-yellow-900 mb-3 flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  Pro Tips
                </h3>
                <div className="space-y-2">
                  <div className="text-xs text-yellow-800">
                    Use batch uploads for datasets over 100MB
                  </div>
                  <div className="text-xs text-yellow-800">
                    Enable auto-transforms to save 80% processing time
                  </div>
                  <div className="text-xs text-yellow-800">
                    Set quality thresholds to ensure data standards
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ExternalLink className="w-3 h-3" />
                  Quick Links
                </h3>
                <div className="space-y-1">
                  <a href="/dashboard" className="flex items-center space-x-2 text-xs text-gray-600 hover:text-blue-600 transition-colors group">
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                    <span>Go to Dashboard</span>
                  </a>
                  <a href="https://github.com/pollarbase/python-sdk" className="flex items-center space-x-2 text-xs text-gray-600 hover:text-blue-600 transition-colors group" target="_blank">
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                    <span>Python SDK</span>
                  </a>
                  <a href="https://github.com/pollarbase/js-sdk" className="flex items-center space-x-2 text-xs text-gray-600 hover:text-blue-600 transition-colors group" target="_blank">
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                    <span>JavaScript SDK</span>
                  </a>
                  <a href="https://status.pollarbase.com" className="flex items-center space-x-2 text-xs text-gray-600 hover:text-blue-600 transition-colors group" target="_blank">
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                    <span>API Status</span>
                  </a>
                </div>
              </div>

              {/* Support */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
                <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <HelpCircle className="w-3 h-3" />
                  Need Help?
                </h3>
                <p className="text-xs text-blue-800 mb-3 leading-relaxed">
                  Get support from our team or connect with the community.
                </p>
                <div className="space-y-1">
                  <a href="mailto:support@pollarbase.com" className="flex items-center space-x-2 text-xs text-blue-700 hover:text-blue-800 transition-colors">
                    <span>Email Support</span>
                  </a>
                  <a href="https://discord.gg/pollarbase" className="flex items-center space-x-2 text-xs text-blue-700 hover:text-blue-800 transition-colors" target="_blank">
                    <span>Discord Community</span>
                  </a>
                </div>
              </div>

              {/* API Health */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-green-500" />
                  API Status
                </h3>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">API Health</span>
                    <span className="flex items-center text-xs text-green-600">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                      Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Response Time</span>
                    <span className="text-xs text-gray-900 font-medium">45ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Uptime</span>
                    <span className="text-xs text-gray-900 font-medium">99.9%</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      
      {/* Enhanced Documentation Footer */}
      <footer className="bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200 mt-16">
        <div className="max-w-[1400px] mx-auto px-8 lg:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-900">Pollarbase</span>
                  <div className="text-sm text-gray-500 font-medium">Documentation</div>
                </div>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-6 max-w-md">
                The comprehensive API platform that handles your data schlep. Transform messy data into ML-ready datasets with 
                <strong> 95%+ accuracy</strong> using advanced AI algorithms.
              </p>
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">All systems operational</span>
                </div>
                <div className="text-xs text-gray-500">Last updated: 5 min ago</div>
              </div>
              <div className="flex items-center space-x-4 text-xs text-gray-600">
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span>99.9% uptime</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>45ms avg response</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Book className="w-4 h-4 mr-2" />
                Getting Started
              </h4>
              <div className="space-y-3">
                <button onClick={() => setSelectedSection('introduction')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">
                  Introduction
                </button>
                <button onClick={() => setSelectedSection('quickstart')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Quickstart Guide
                </button>
                <button onClick={() => setSelectedSection('authentication')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Authentication
                </button>
                <button onClick={() => setSelectedSection('python-sdk')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Python SDK
                </button>
                <button onClick={() => setSelectedSection('javascript-sdk')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  JavaScript SDK
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Code className="w-4 h-4 mr-2" />
                API Reference
              </h4>
              <div className="space-y-3">
                <button onClick={() => setSelectedSection('upload-api')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Upload API
                </button>
                <button onClick={() => setSelectedSection('analysis-api')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Analysis API
                </button>
                <button onClick={() => setSelectedSection('transformation-api')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Transform API
                </button>
                <button onClick={() => setSelectedSection('export-api')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Export API
                </button>
                <button onClick={() => setSelectedSection('anomaly-detection')} className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  Anomaly Detection
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <HelpCircle className="w-4 h-4 mr-2" />
                Support & Links
              </h4>
              <div className="space-y-3">
                <a href="/dashboard" className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors group">
                  <span className="mr-2">🚀</span>
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <a href="mailto:support@pollarbase.com" className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  <span className="mr-2">✉️</span>
                  <span>Email Support</span>
                </a>
                <a href="https://discord.gg/pollarbase" className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors" target="_blank">
                  <span className="mr-2">💬</span>
                  <span>Discord Community</span>
                </a>
                <a href="https://status.pollarbase.com" className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors" target="_blank">
                  <span className="mr-2">📊</span>
                  <span>Status Page</span>
                </a>
                <a href="https://github.com/pollarbase/pollarbase" className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors" target="_blank">
                  <span className="mr-2">🔗</span>
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-300 mt-10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
                <p className="text-gray-700 text-sm font-medium">
                  © 2024 Pollarbase. The Data Schlep Handler.
                </p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <a href="/terms" className="hover:text-gray-700 transition-colors">Terms</a>
                  <a href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</a>
                  <a href="/security" className="hover:text-gray-700 transition-colors">Security</a>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-500">Built with ❤️ for data teams</span>
                <div className="flex items-center space-x-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  <span className="font-medium">v2.1.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}