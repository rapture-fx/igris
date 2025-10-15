import { ArrowRightIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function PipelinePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Data Processing Pipeline</h1>
        <p className="text-xl text-gray-600">
          Learn how Schlep Engine transforms messy, unstructured data into clean, ML-ready datasets through an intelligent, automated pipeline.
        </p>
      </div>

      {/* Pipeline Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Pipeline Overview</h2>
        
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="text-center">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold">1</div>
                <p className="mt-2 text-sm font-medium">Ingest</p>
              </div>
              <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              <div className="text-center">
                <div className="bg-yellow-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold">2</div>
                <p className="mt-2 text-sm font-medium">Analyze</p>
              </div>
              <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              <div className="text-center">
                <div className="bg-orange-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold">3</div>
                <p className="mt-2 text-sm font-medium">Clean</p>
              </div>
              <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              <div className="text-center">
                <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold">4</div>
                <p className="mt-2 text-sm font-medium">Transform</p>
              </div>
              <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              <div className="text-center">
                <div className="bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold">5</div>
                <p className="mt-2 text-sm font-medium">Export</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-gray-600 leading-relaxed">
          The Schlep Engine pipeline is designed to handle the most challenging data preparation tasks automatically. 
          From messy CSV files with inconsistent formatting to complex document extraction from PDFs, 
          our AI-powered pipeline ensures your data is ready for machine learning in minutes, not days.
        </p>
      </section>

      {/* Stage 1: Data Ingestion */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Stage 1: Data Ingestion</h2>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Multi-Format Support</h3>
          <p className="text-gray-700 mb-4">
            Our ingestion layer automatically detects and handles over 50+ file formats and data sources:
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-medium text-sm">Structured</p>
                <p className="text-xs text-gray-600 mt-1">CSV, JSON, Excel, TSV</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-medium text-sm">Documents</p>
                <p className="text-xs text-gray-600 mt-1">PDF, DOC, TXT, HTML</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-medium text-sm">Images</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG, OCR Text</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-medium text-sm">Databases</p>
                <p className="text-xs text-gray-600 mt-1">SQL, NoSQL, APIs</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Key Features:</h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700"><strong>Automatic Format Detection:</strong> Intelligently identifies file types, encodings, and structural patterns</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700"><strong>Stream Processing:</strong> Handles large files through chunked processing and streaming APIs</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700"><strong>Error Recovery:</strong> Robust handling of corrupted or malformed data with detailed error reporting</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Stage 2: Data Analysis */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Stage 2: Intelligent Analysis</h2>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">AI-Powered Data Profiling</h3>
          <p className="text-gray-700 mb-4">
            Before any cleaning begins, our AI analyzes your data to understand its structure, 
            quality, and potential issues. This analysis guides the entire pipeline process.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3">Statistical Analysis</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Data type inference and validation</li>
              <li>• Distribution analysis and outlier detection</li>
              <li>• Missing value pattern identification</li>
              <li>• Correlation analysis between variables</li>
              <li>• Duplicate record detection</li>
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3">Semantic Understanding</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Column purpose identification (name, email, date)</li>
              <li>• PII detection and classification</li>
              <li>• Business domain recognition</li>
              <li>• Relationship mapping between entities</li>
              <li>• Quality scoring and recommendations</li>
            </ul>
          </div>
        </div>

        <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                <strong>Quality Assessment:</strong> Every dataset receives a comprehensive quality score with detailed 
                breakdowns across completeness, validity, consistency, accuracy, and uniqueness dimensions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stage 3: Data Cleaning */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Stage 3: Automated Cleaning</h2>
        
        <div className="bg-orange-50 border-l-4 border-orange-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Smart Data Cleaning</h3>
          <p className="text-gray-700">
            Based on the analysis results, our AI applies targeted cleaning operations that preserve 
            data integrity while maximizing usability for machine learning applications.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold mb-3 text-orange-600">Missing Data</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Intelligent imputation strategies</li>
                <li>• Context-aware default values</li>
                <li>• Forward/backward fill for time series</li>
                <li>• ML-based value prediction</li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold mb-3 text-orange-600">Data Standardization</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Format normalization (dates, phones)</li>
                <li>• Case and whitespace standardization</li>
                <li>• Unit conversion and scaling</li>
                <li>• Category consolidation</li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold mb-3 text-orange-600">Outlier Handling</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Statistical outlier detection</li>
                <li>• Domain-specific anomaly rules</li>
                <li>• Capping and transformation options</li>
                <li>• Flagging for manual review</li>
              </ul>
            </div>
          </div>

          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>Validation at Every Step:</strong> All cleaning operations include validation checks 
                  to ensure data integrity is maintained throughout the process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stage 4: Feature Engineering */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Stage 4: Feature Engineering</h2>
        
        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">ML-Ready Transformation</h3>
          <p className="text-gray-700">
            Transform your clean data into features optimized for machine learning, with automatic 
            encoding, scaling, and feature creation based on your specific use case.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-semibold">Automatic Transformations:</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="bg-green-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Categorical Encoding</p>
                  <p className="text-xs text-gray-600">One-hot, label, and target encoding based on cardinality</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-green-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Numerical Scaling</p>
                  <p className="text-xs text-gray-600">StandardScaler, MinMax, or Robust scaling selection</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-green-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">DateTime Features</p>
                  <p className="text-xs text-gray-600">Extract hour, day, month, season, and cyclical features</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-green-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Text Processing</p>
                  <p className="text-xs text-gray-600">TF-IDF, embeddings, and sentiment analysis</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Advanced Features:</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Interaction Features</p>
                  <p className="text-xs text-gray-600">Polynomial features and cross-variable interactions</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Aggregation Features</p>
                  <p className="text-xs text-gray-600">Statistical summaries and window functions</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Feature Selection</p>
                  <p className="text-xs text-gray-600">Automatic selection of most predictive features</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1">
                  <CheckCircleIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Domain-Specific</p>
                  <p className="text-xs text-gray-600">Industry-specific feature engineering templates</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Stage 5: Export & Integration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Stage 5: Export & Integration</h2>
        
        <div className="bg-purple-50 border-l-4 border-purple-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Seamless ML Integration</h3>
          <p className="text-gray-700">
            Export your processed data in formats optimized for your preferred ML platform, 
            complete with metadata, feature descriptions, and pipeline configurations.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <p className="font-medium text-sm mb-2">Python/Pandas</p>
            <p className="text-xs text-gray-600">DataFrame, Pickle, NumPy</p>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <p className="font-medium text-sm mb-2">Cloud ML</p>
            <p className="text-xs text-gray-600">AWS SageMaker, Google AI</p>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <p className="font-medium text-sm mb-2">Notebooks</p>
            <p className="text-xs text-gray-600">Jupyter, Colab, Databricks</p>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <p className="font-medium text-sm mb-2">Databases</p>
            <p className="text-xs text-gray-600">PostgreSQL, MongoDB</p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Pipeline Reproducibility:</strong> Every processing step is tracked and can be 
                reproduced with full versioning, ensuring consistent results across environments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Real-time Processing */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Real-time Processing</h2>
        
        <p className="text-gray-600 mb-6">
          Beyond batch processing, Schlep Engine supports real-time data processing for streaming applications:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3">Streaming Ingestion</h4>
            <p className="text-sm text-gray-600 mb-3">
              Connect to Kafka, WebSockets, or HTTP streams for continuous data processing.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Real-time quality monitoring</li>
              <li>• Automated alerting</li>
              <li>• Stream processing rules</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3">Live Transformations</h4>
            <p className="text-sm text-gray-600 mb-3">
              Apply the same cleaning and feature engineering rules to streaming data.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Sub-second latency</li>
              <li>• Consistent transformations</li>
              <li>• Error handling & recovery</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3">ML Inference</h4>
            <p className="text-sm text-gray-600 mb-3">
              Direct integration with real-time ML models for instant predictions.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Model serving</li>
              <li>• A/B testing support</li>
              <li>• Performance monitoring</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}