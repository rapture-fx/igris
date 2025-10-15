import { ArrowPathIcon, CubeTransparentIcon, CloudIcon } from '@heroicons/react/24/outline'

export default function ArchitecturePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Industrial Data Processing Architecture</h1>
        <p className="text-xl text-gray-600">
          Understanding how Schlep Engine processes industrial sensor data with multi-modal anomaly detection and manufacturing quality assessment.
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
              <h3 className="font-semibold text-lg mb-2">Sensor Data Ingestion</h3>
              <p className="text-gray-600 text-sm">
                Handles industrial sensor streams including temperature, pressure, vibration, and flow sensors with data validation.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ArrowPathIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Quality Assessment Engine</h3>
              <p className="text-gray-600 text-sm">
                Statistical analysis and anomaly detection using IsolationForest, DBSCAN, OneClassSVM for manufacturing data.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CubeTransparentIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Equipment Monitoring</h3>
              <p className="text-gray-600 text-sm">
                Real-time equipment health assessment with cross-sensor correlation and maintenance alert generation.
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
            <h3 className="text-xl font-semibold mb-3">Industrial Data Quality Engine</h3>
            <p className="text-gray-600 mb-4">
              The core processing engine specialized for industrial sensor data validation and quality assessment 
              with manufacturing-specific algorithms and statistical process control.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Sensor data validation and drift detection</li>
              <li>Multi-format manufacturing document support (PDF, Excel, CSV)</li>
              <li>Statistical quality assessment and pattern detection</li>
              <li>Real-time sensor monitoring capabilities</li>
            </ul>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <h3 className="text-xl font-semibold mb-3">Anomaly Detection Services</h3>
            <p className="text-gray-600 mb-4">
              Multi-modal anomaly detection algorithms specifically designed for industrial sensor data 
              and manufacturing equipment monitoring with proven statistical methods.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>IsolationForest for temperature and pressure outlier detection</li>
              <li>DBSCAN for vibration pattern analysis and clustering</li>
              <li>OneClassSVM for multi-sensor correlation anomalies</li>
              <li>Statistical control charts with 3-sigma limits</li>
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
            <h3 className="font-semibold text-lg mb-4">Industrial Analytics Stack</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">scikit-learn</span>
                <span className="text-gray-600 text-sm">IsolationForest, DBSCAN, OneClassSVM algorithms</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">pandas</span>
                <span className="text-gray-600 text-sm">Sensor data manipulation and time series analysis</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm font-medium">numpy</span>
                <span className="text-gray-600 text-sm">Statistical calculations and signal processing</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-sm font-medium">scipy</span>
                <span className="text-gray-600 text-sm">Statistical analysis and correlation functions</span>
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
                  <strong>Security:</strong> Standard web application security practices with JWT authentication, 
                  HTTPS encryption, and basic access controls for industrial data protection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Capabilities Assessment */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Current Architecture Capabilities</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-800 mb-4">✓ What Works Today</h3>
            <ul className="text-sm text-green-700 space-y-2">
              <li>• Multi-modal anomaly detection (4 proven algorithms)</li>
              <li>• Industrial sensor data validation and quality assessment</li>
              <li>• Cross-sensor correlation analysis</li>
              <li>• Real-time equipment health monitoring</li>
              <li>• Document processing (PDF, Excel, Word)</li>
              <li>• Statistical process control and pattern detection</li>
              <li>• REST API with proper authentication</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-800 mb-4">⚠️ Architecture Limitations</h3>
            <ul className="text-sm text-yellow-700 space-y-2">
              <li>• No advanced machine learning model training</li>
              <li>• Limited to statistical analysis methods</li>
              <li>• No deep learning or neural network integration</li>
              <li>• No AutoML pipeline generation</li>
              <li>• Basic compliance features (not enterprise-grade)</li>
              <li>• Limited scalability (thousands, not millions of sensors)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}