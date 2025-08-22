import { ArrowPathIcon, CubeTransparentIcon, CloudIcon } from '@heroicons/react/24/outline'

export default function ArchitecturePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Architecture Overview</h1>
        <p className="text-xl text-gray-600">
          Understanding the Schlep Engine platform architecture and how components work together to transform messy data into ML-ready datasets.
        </p>
      </div>

      {/* High-Level Architecture */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">High-Level Architecture</h2>
        
        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CloudIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Data Ingestion Layer</h3>
              <p className="text-gray-600 text-sm">
                Handles multiple data sources, formats, and streaming protocols with intelligent routing and preprocessing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ArrowPathIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Processing Engine</h3>
              <p className="text-gray-600 text-sm">
                AI-powered data processing pipeline with automated cleaning, validation, and feature engineering capabilities.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CubeTransparentIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">ML Integration Layer</h3>
              <p className="text-gray-600 text-sm">
                Seamless integration with popular ML platforms and frameworks for training and deployment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Components */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Core Components</h2>
        
        <div className="space-y-8">
          <div className="border-l-4 border-blue-500 pl-6">
            <h3 className="text-xl font-semibold mb-3">API Gateway & Authentication</h3>
            <p className="text-gray-600 mb-4">
              The API Gateway serves as the single entry point for all client requests, handling authentication, 
              rate limiting, request routing, and response transformation. Built on FastAPI with OAuth2 and JWT support.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>RESTful API endpoints with OpenAPI documentation</li>
              <li>OAuth2 and SAML SSO integration</li>
              <li>Role-based access control (RBAC)</li>
              <li>Rate limiting and API key management</li>
            </ul>
          </div>

          <div className="border-l-4 border-green-500 pl-6">
            <h3 className="text-xl font-semibold mb-3">Data Processing Pipeline</h3>
            <p className="text-gray-600 mb-4">
              The core processing engine that handles data transformation, cleaning, and validation. 
              Uses a microservices architecture with distributed task queues for scalability.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Investigation-based data organization</li>
              <li>Multi-format file support (CSV, JSON, Excel, PDF, etc.)</li>
              <li>AI-powered data cleaning and validation</li>
              <li>Real-time and batch processing capabilities</li>
            </ul>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <h3 className="text-xl font-semibold mb-3">ML & AI Services</h3>
            <p className="text-gray-600 mb-4">
              Advanced machine learning capabilities including AutoML, feature engineering, 
              and predictive analytics powered by state-of-the-art AI models.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>AutoML pipeline creation and training</li>
              <li>Intelligent insights generation</li>
              <li>Predictive analytics and forecasting</li>
              <li>Real-time model serving and inference</li>
            </ul>
          </div>

          <div className="border-l-4 border-orange-500 pl-6">
            <h3 className="text-xl font-semibold mb-3">Data Storage & Management</h3>
            <p className="text-gray-600 mb-4">
              Hybrid storage architecture combining PostgreSQL for structured data, Redis for caching, 
              and cloud storage for files and large datasets.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>PostgreSQL for transactional data and metadata</li>
              <li>Redis for session management and caching</li>
              <li>Cloud storage (S3, GCS, Azure) for files</li>
              <li>Data versioning and lineage tracking</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Technology Stack</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">Backend Services</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">FastAPI</span>
                <span className="text-gray-600 text-sm">High-performance Python web framework</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">PostgreSQL</span>
                <span className="text-gray-600 text-sm">Primary database for structured data</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">Redis</span>
                <span className="text-gray-600 text-sm">Caching and session management</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">Celery</span>
                <span className="text-gray-600 text-sm">Distributed task queue processing</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">ML & AI Stack</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">scikit-learn</span>
                <span className="text-gray-600 text-sm">Machine learning algorithms</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">pandas</span>
                <span className="text-gray-600 text-sm">Data manipulation and analysis</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm font-medium">Transformers</span>
                <span className="text-gray-600 text-sm">NLP and text processing</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-sm font-medium">OpenAI</span>
                <span className="text-gray-600 text-sm">Advanced AI capabilities</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment Architecture */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Deployment Architecture</h2>
        
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Production Deployment Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <h4 className="font-medium mb-2">Cloud Native</h4>
              <p className="text-sm text-gray-600">
                Kubernetes orchestration with auto-scaling and high availability across multiple cloud providers.
              </p>
            </div>
            <div className="text-center">
              <h4 className="font-medium mb-2">Hybrid</h4>
              <p className="text-sm text-gray-600">
                Combination of managed cloud services (Supabase, Redis Cloud) with custom compute resources.
              </p>
            </div>
            <div className="text-center">
              <h4 className="font-medium mb-2">On-Premise</h4>
              <p className="text-sm text-gray-600">
                Enterprise deployment within customer infrastructure with full data sovereignty.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Scalability:</strong> The architecture supports horizontal scaling across all components, 
                with automatic load balancing and resource allocation based on demand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Security Architecture</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Authentication & Authorization</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• JWT-based authentication with refresh tokens</li>
                <li>• OAuth2 and SAML SSO integration</li>
                <li>• Role-based access control (RBAC)</li>
                <li>• API key management with scoped permissions</li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Data Protection</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Encryption at rest and in transit (AES-256, TLS 1.3)</li>
                <li>• PII detection and automatic redaction</li>
                <li>• Audit logging for compliance</li>
                <li>• Data retention and deletion policies</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>Compliance:</strong> Built-in support for GDPR, HIPAA, SOC2, and other compliance frameworks 
                  with comprehensive audit trails and data governance controls.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}