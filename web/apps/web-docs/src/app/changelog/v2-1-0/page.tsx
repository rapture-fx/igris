export default function ChangelogV210Page() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Version 2.1.0</h1>
        <p className="text-xl text-gray-600">
          Released October 18, 2023 - Advanced data transformation, improved ML model management, and enhanced collaboration features.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🚀 New Features</h2>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Advanced Data Transformation</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>Custom Transformation Rules:</strong> Define complex data transformation logic</li>
              <li>• <strong>Conditional Processing:</strong> Apply transformations based on data conditions</li>
              <li>• <strong>Data Aggregation:</strong> Built-in aggregation functions for statistical analysis</li>
              <li>• <strong>Join Operations:</strong> Merge datasets from multiple sources</li>
            </ul>
          </div>

          <div className="bg-green-50 border-l-4 border-green-400 p-6">
            <h3 className="font-semibold mb-3">ML Model Management</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>Model Versioning:</strong> Track and manage multiple model versions</li>
              <li>• <strong>A/B Testing Framework:</strong> Compare model performance in production</li>
              <li>• <strong>Model Monitoring:</strong> Real-time performance tracking and alerts</li>
              <li>• <strong>Automated Retraining:</strong> Scheduled model updates based on data drift</li>
            </ul>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-400 p-6">
            <h3 className="font-semibold mb-3">Team Collaboration</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>Shared Workspaces:</strong> Collaborate on investigations with team members</li>
              <li>• <strong>Comment System:</strong> Add comments and annotations to datasets</li>
              <li>• <strong>Version Control:</strong> Track changes and revert to previous versions</li>
              <li>• <strong>Permission Management:</strong> Fine-grained access control for teams</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">✨ Improvements</h2>
        
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Data Processing Engine</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• 30% faster processing for complex transformations</li>
              <li>• Improved error handling with detailed error messages</li>
              <li>• Enhanced data type detection and conversion</li>
              <li>• Better handling of missing values and null data</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">User Experience</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• Redesigned data preview with enhanced filtering options</li>
              <li>• Improved file upload interface with drag-and-drop</li>
              <li>• Enhanced progress tracking for long-running operations</li>
              <li>• Better mobile responsiveness across all pages</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Integration Capabilities</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• Enhanced REST API with better documentation</li>
              <li>• Python SDK improvements with type hints</li>
              <li>• New webhook endpoints for real-time notifications</li>
              <li>• Improved database connectivity options</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🐛 Bug Fixes</h2>
        
        <div className="bg-gray-50 rounded-lg p-6">
          <ul className="space-y-2 text-gray-700">
            <li>• Fixed issue with Excel files containing formulas not processing correctly</li>
            <li>• Resolved memory leak in long-running data transformation jobs</li>
            <li>• Fixed authentication issues with certain OAuth providers</li>
            <li>• Corrected data export problems with special characters</li>
            <li>• Fixed model training failures on datasets with high cardinality</li>
            <li>• Resolved UI rendering issues in Safari browser</li>
            <li>• Fixed API rate limiting not working correctly for bulk operations</li>
            <li>• Corrected timezone handling in scheduled data imports</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">📋 API Changes</h2>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">New API Endpoints</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• <code>/api/v1/transformations</code> - Custom data transformation management</li>
              <li>• <code>/api/v1/models/versions</code> - Model version control</li>
              <li>• <code>/api/v1/workspaces</code> - Shared workspace management</li>
              <li>• <code>/api/v1/comments</code> - Dataset commenting system</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Updated Endpoints</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• <code>/api/v1/investigations</code> - Added collaboration features</li>
              <li>• <code>/api/v1/models</code> - Enhanced with monitoring capabilities</li>
              <li>• <code>/api/v1/data</code> - Improved transformation options</li>
              <li>• <code>/api/v1/export</code> - Added new export formats</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔧 Technical Updates</h2>
        
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Backend Improvements</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• Upgraded FastAPI framework to latest version</li>
              <li>• Improved database connection pooling</li>
              <li>• Enhanced caching layer with Redis optimization</li>
              <li>• Better error logging and monitoring</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Frontend Enhancements</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• Updated React components for better performance</li>
              <li>• Improved state management with Redux toolkit</li>
              <li>• Enhanced data visualization components</li>
              <li>• Better accessibility compliance (WCAG 2.1)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">📊 Performance Improvements</h2>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Benchmark Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">+30%</p>
              <p className="text-sm text-gray-600">Transform Speed</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">+25%</p>
              <p className="text-sm text-gray-600">UI Responsiveness</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">-15%</p>
              <p className="text-sm text-gray-600">Memory Usage</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">50%</p>
              <p className="text-sm text-gray-600">Error Reduction</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔐 Security Enhancements</h2>
        
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Security Updates</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• Enhanced data encryption with AES-256 standards</li>
              <li>• Improved API authentication with JWT token refresh</li>
              <li>• Enhanced input validation and sanitization</li>
              <li>• Updated security headers and CORS policies</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Compliance Features</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• Enhanced audit logging for regulatory compliance</li>
              <li>• Data retention policies and automated cleanup</li>
              <li>• Privacy controls for sensitive data handling</li>
              <li>• Compliance reporting tools and dashboards</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🎯 Migration Notes</h2>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
          <h3 className="font-semibold mb-3">Upgrade Instructions</h3>
          <ol className="space-y-2 text-gray-700">
            <li>1. <strong>Backup data:</strong> Create complete backup of all investigations</li>
            <li>2. <strong>Update API clients:</strong> Update to latest SDK version for new features</li>
            <li>3. <strong>Review permissions:</strong> Check and update user permissions for new collaboration features</li>
            <li>4. <strong>Test transformations:</strong> Validate existing transformation logic with new engine</li>
            <li>5. <strong>Update integrations:</strong> Refresh webhook URLs and API endpoints</li>
          </ol>
        </div>
      </section>
    </div>
  )
}