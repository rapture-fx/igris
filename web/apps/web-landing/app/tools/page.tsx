'use client'

import { useState } from 'react'
import {
  Terminal,
  Download,
  Code2,
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  Package,
  Github,
  FileText,
  Command,
  Zap,
  Database,
  Settings,
  Play,
  Eye
} from 'lucide-react'

interface Tool {
  id: string
  name: string
  description: string
  category: 'sdk' | 'cli' | 'integration' | 'example'
  language?: string
  version: string
  downloadUrl: string
  docsUrl: string
  githubUrl?: string
  installCommand?: string
  features: string[]
  codeExample: string
}

export default function SDKTools() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('sdk')

  const tools: Tool[] = [
    {
      id: '1',
      name: 'Python SDK',
      description: 'Official Python SDK for Igris Inertial with async support and batch processing',
      category: 'sdk',
      language: 'Python',
      version: '2.1.0',
      downloadUrl: 'https://pypi.org/project/igris-inertial/',
      docsUrl: '/docs/python-sdk',
      githubUrl: 'https://github.com/igris-inertial/python-sdk',
      installCommand: 'pip install igris-inertial',
      features: [
        'Async/await support',
        'Batch data processing',
        'Built-in retry logic',
        'Type hints included',
        'Pipeline orchestration',
        'Real-time monitoring'
      ],
      codeExample: `from igris_inertial import IgrisClient
import asyncio

# Initialize client
client = IgrisClient(api_key="your_api_key")

# Upload and process data
async def process_data():
    # Upload dataset
    dataset = await client.datasets.upload("data.csv")
    print(f"Dataset uploaded: {dataset.id}")
    
    # Create processing pipeline
    pipeline = client.pipelines.create({
        "name": "Data Processing Pipeline",
        "steps": [
            {"type": "validate", "schema": "customer_schema.json"},
            {"type": "clean", "remove_duplicates": True},
            {"type": "transform", "normalize": True}
        ]
    })
    
    # Execute pipeline
    result = await pipeline.run(dataset.id)
    print(f"Processing complete: {result.status}")

# Run the async function
asyncio.run(process_data())`
    },
    {
      id: '2',
      name: 'JavaScript/Node.js SDK',
      description: 'Modern JavaScript SDK with TypeScript support for web and Node.js applications',
      category: 'sdk',
      language: 'JavaScript',
      version: '1.4.0',
      downloadUrl: 'https://www.npmjs.com/package/@igris-inertial/sdk',
      docsUrl: '/docs/javascript-sdk',
      githubUrl: 'https://github.com/igris-inertial/javascript-sdk',
      installCommand: 'npm install @igris-inertial/sdk',
      features: [
        'TypeScript definitions',
        'Promise-based API',
        'Browser & Node.js support',
        'Webhook handling',
        'Stream processing',
        'Real-time updates'
      ],
      codeExample: `import { IgrisClient } from '@igris-inertial/sdk';

// Initialize client
const client = new IgrisClient({
  apiKey: process.env.IGRIS_API_KEY
});

// Upload and process data
async function processData() {
  try {
    // Upload dataset
    const dataset = await client.datasets.upload({
      file: 'data.csv',
      format: 'csv'
    });
    
    console.log('Dataset uploaded:', dataset.id);
    
    // Start ML auto-labeling
    const job = await client.ml.autoLabel({
      datasetId: dataset.id,
      model: 'classification_v2',
      confidenceThreshold: 0.85
    });
    
    // Wait for completion
    const result = await job.wait();
    console.log('Auto-labeling complete:', result);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

processData();`
    },
    {
      id: '3',
      name: 'CLI Tool',
      description: 'Command-line interface for managing datasets, pipelines, and deployments',
      category: 'cli',
      version: '3.0.0',
      downloadUrl: 'https://github.com/igris-inertial/cli/releases',
      docsUrl: '/docs/cli',
      githubUrl: 'https://github.com/igris-inertial/cli',
      installCommand: 'curl -fsSL https://igrisinertial.com/install | bash',
      features: [
        'Dataset management',
        'Pipeline orchestration',
        'Deployment automation',
        'Interactive mode',
        'Configuration profiles',
        'Batch operations'
      ],
      codeExample: `# Install Igris Inertial CLI
curl -fsSL https://igrisinertial.com/install | bash

# Check install and run the first demo
igris doctor
igris demo --recover-prove

# Upload a dataset
igris data upload data.csv --name "Customer Data"

# Create and run a pipeline
igris pipeline create processing_pipeline.yaml
igris pipeline run processing_pipeline --input dataset_123

# Monitor job status
igris jobs list --status running
igris jobs logs job_456

# Deploy a model
igris models deploy model_789 --name "production-classifier"

# Batch process multiple files
igris data batch-upload ./datasets/*.csv --parallel 4`
    },
    {
      id: '4',
      name: 'REST API Client',
      description: 'Direct REST API integration examples and utilities',
      category: 'integration',
      version: '1.0.0',
      downloadUrl: '/docs/api',
      docsUrl: '/docs/rest-api',
      features: [
        'OpenAPI 3.0 specification',
        'Webhook support',
        'Rate limiting',
        'Authentication',
        'Error handling',
        'Pagination'
      ],
      codeExample: `# Authentication
curl -X POST "https://api.igris-inertial.com/v1/auth" \\
  -H "Content-Type: application/json" \\
  -d '{"api_key": "your_api_key"}'

# Upload dataset
curl -X POST "https://api.igris-inertial.com/v1/data/upload" \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@data.csv" \\
  -F "name=Customer Data"

# Get dataset status
curl -X GET "https://api.igris-inertial.com/v1/data/$DATASET_ID/status" \\
  -H "Authorization: Bearer $TOKEN"

# Start ML auto-labeling
curl -X POST "https://api.igris-inertial.com/v1/ml/auto-label" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "'$DATASET_ID'",
    "model": "classification_v2",
    "confidence_threshold": 0.85
  }'

# Webhook endpoint example
curl -X POST "https://api.igris-inertial.com/v1/webhooks" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/igris",
    "events": ["dataset.processed", "job.completed"]
  }'`
    },
    {
      id: '5',
      name: 'Jupyter Notebook Examples',
      description: 'Interactive notebooks demonstrating common workflows and use cases',
      category: 'example',
      language: 'Python',
      version: '1.0.0',
      downloadUrl: 'https://github.com/igris-inertial/examples',
      docsUrl: '/docs/notebooks',
      githubUrl: 'https://github.com/igris-inertial/examples',
      features: [
        'Data exploration',
        'Model training workflows',
        'Visualization examples',
        'Best practices',
        'Performance optimization',
        'Error handling patterns'
      ],
      codeExample: `# Igris Inertial - Data Processing Workflow
# This notebook demonstrates end-to-end data processing

import pandas as pd
from igris_inertial import IgrisClient
import matplotlib.pyplot as plt

# Initialize client
client = IgrisClient(api_key="your_api_key")

# Load and explore data
df = pd.read_csv("sample_data.csv")
print(f"Dataset shape: {df.shape}")
df.head()

# Upload to Igris Inertial
dataset = client.datasets.upload_dataframe(
    df, 
    name="Customer Analysis Dataset"
)

# Check data quality
quality_report = client.datasets.analyze_quality(dataset.id)
print(f"Quality Score: {quality_report.score}")

# Visualize quality issues
issues_df = pd.DataFrame(quality_report.issues)
issues_df.groupby('type')['count'].sum().plot(kind='bar')
plt.title('Data Quality Issues by Type')
plt.show()

# Apply ML auto-labeling
labeling_job = client.ml.auto_label(
    dataset_id=dataset.id,
    model="customer_segmentation_v3"
)

# Wait for completion and get results
result = labeling_job.wait()
labeled_data = client.datasets.download(result.output_dataset_id)`
    },
    {
      id: '6',
      name: 'Docker Integration',
      description: 'Containerized processing with Docker and Kubernetes deployment examples',
      category: 'integration',
      version: '1.2.0',
      downloadUrl: 'https://hub.docker.com/r/igris-inertial/processor',
      docsUrl: '/docs/docker',
      githubUrl: 'https://github.com/igris-inertial/docker',
      features: [
        'Pre-built Docker images',
        'Kubernetes manifests',
        'Auto-scaling support',
        'Health checks',
        'Logging configuration',
        'Secret management'
      ],
      codeExample: `# Dockerfile for custom Igris Inertial processor
FROM igris-inertial/processor:latest

# Copy your custom processing scripts
COPY ./processors /app/processors
COPY requirements.txt /app/

# Install additional dependencies
RUN pip install -r requirements.txt

# Set environment variables
ENV IGRIS_API_KEY=\${IGRIS_API_KEY}
ENV PROCESSOR_TYPE=custom_nlp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \\
  CMD curl -f http://localhost:8080/health || exit 1

# Start the processor
CMD ["python", "/app/main.py"]

---
# docker-compose.yml
version: '3.8'
services:
  igris-processor:
    image: your-registry/igris-processor:latest
    environment:
      - IGRIS_API_KEY=\${IGRIS_API_KEY}
      - PROCESSOR_TYPE=batch_processing
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    
  igris-monitor:
    image: igris-inertial/monitor:latest
    ports:
      - "3000:3000"
    environment:
      - IGRIS_API_KEY=\${IGRIS_API_KEY}
    depends_on:
      - igris-processor`
    }
  ]

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sdk': return <Package className="w-5 h-5" />
      case 'cli': return <Terminal className="w-5 h-5" />
      case 'integration': return <Zap className="w-5 h-5" />
      case 'example': return <BookOpen className="w-5 h-5" />
      default: return <FileText className="w-5 h-5" />
    }
  }

  const categories = [
    { id: 'sdk', name: 'SDKs', count: tools.filter(t => t.category === 'sdk').length },
    { id: 'cli', name: 'CLI Tools', count: tools.filter(t => t.category === 'cli').length },
    { id: 'integration', name: 'Integrations', count: tools.filter(t => t.category === 'integration').length },
    { id: 'example', name: 'Examples', count: tools.filter(t => t.category === 'example').length }
  ]

  const filteredTools = tools.filter(tool => tool.category === activeCategory)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">SDK & CLI Tools</h1>
              <p className="text-gray-400 mt-1">Developer tools and integrations for Igris Inertial</p>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="https://docs.igrisinertial.com/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Documentation
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Category Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-[#161616] border border-gray-800 rounded-xl p-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === category.id
                  ? 'bg-[#468BE6] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
              >
                {getCategoryIcon(category.id)}
                <span>{category.name}</span>
                <span className="text-xs bg-black/20 px-1.5 py-0.5 rounded">{category.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tools List */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-6">
              {filteredTools.map((tool) => (
                <div
                  key={tool.id}
                  className={`bg-[#161616] border rounded-xl p-6 cursor-pointer transition-all hover:border-[#468BE6]/50 ${selectedTool?.id === tool.id ? 'border-[#468BE6] ring-1 ring-[#468BE6]/50' : 'border-gray-800'
                    }`}
                  onClick={() => setSelectedTool(tool)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-[#0f0f0f] border border-gray-800 rounded-lg">
                        {getCategoryIcon(tool.category)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-base font-semibold text-white">{tool.name}</h3>
                          <span className="text-xs text-[#468BE6] bg-[#468BE6]/10 px-2 py-1 rounded">
                            v{tool.version}
                          </span>
                          {tool.language && (
                            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                              {tool.language}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-4">{tool.description}</p>

                        {/* Features */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {tool.features.slice(0, 3).map((feature, index) => (
                            <span
                              key={index}
                              className="text-xs text-gray-300 bg-gray-800/50 px-2 py-1 rounded"
                            >
                              {feature}
                            </span>
                          ))}
                          {tool.features.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{tool.features.length - 3} more
                            </span>
                          )}
                        </div>

                        {/* Install Command */}
                        {tool.installCommand && (
                          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <code className="text-sm text-gray-300 font-mono">
                                {tool.installCommand}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(tool.installCommand!, `install-${tool.id}`)
                                }}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                              >
                                {copiedCode === `install-${tool.id}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="flex items-center space-x-2">
                      <a
                        href={tool.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center px-3 py-1.5 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors text-sm"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </a>
                      <a
                        href={tool.docsUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center px-3 py-1.5 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors text-sm"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Docs
                      </a>
                    </div>
                    <div className="flex items-center space-x-2">
                      {tool.githubUrl && (
                        <a
                          href={tool.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                        >
                          <Github className="w-3 h-3 text-gray-400" />
                        </a>
                      )}
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tool Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 sticky top-8">
              <h3 className="text-base font-semibold text-white mb-4">
                {selectedTool ? 'Code Example' : 'Select a Tool'}
              </h3>

              {selectedTool ? (
                <div className="space-y-4">
                  {/* Tool Info */}
                  <div>
                    <h4 className="text-white font-medium mb-2">{selectedTool.name}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Version:</span>
                        <span className="text-white">v{selectedTool.version}</span>
                      </div>
                      {selectedTool.language && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Language:</span>
                          <span className="text-white">{selectedTool.language}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <div>
                    <h5 className="text-white font-medium mb-2">Features</h5>
                    <div className="space-y-1">
                      {selectedTool.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <div className="w-1.5 h-1.5 bg-[#468BE6] rounded-full"></div>
                          <span className="text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Code Example */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-white font-medium">Code Example</h5>
                      <button
                        onClick={() => copyToClipboard(selectedTool.codeExample, `example-${selectedTool.id}`)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                      >
                        {copiedCode === `example-${selectedTool.id}` ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                        {selectedTool.codeExample}
                      </pre>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <a
                      href={selectedTool.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                    <a
                      href={selectedTool.docsUrl}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Documentation
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Code2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a tool to view code examples and documentation</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
