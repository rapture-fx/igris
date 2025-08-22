export default function BestPracticesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Best Practices</h1>
        <p className="text-xl text-gray-600">
          Essential guidelines and best practices for building robust, scalable, and maintainable ML data pipelines with Schlep Engine.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Organization</h2>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Investigation Structure</h3>
            <p className="text-gray-700 mb-4">
              Organize your data processing work into logical investigations that group related data sources and analyses.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Use descriptive names:</strong> Choose clear, meaningful investigation names that describe the business objective</li>
              <li>• <strong>Group related data:</strong> Keep similar data sources and analyses within the same investigation</li>
              <li>• <strong>Maintain consistent structure:</strong> Establish naming conventions and folder hierarchies</li>
              <li>• <strong>Document objectives:</strong> Include clear descriptions and metadata for each investigation</li>
            </ul>
          </div>

          <div className="bg-green-50 border-l-4 border-green-400 p-6">
            <h3 className="font-semibold mb-3">File Management</h3>
            <p className="text-gray-700 mb-4">
              Implement consistent file naming and organization patterns for better discoverability and maintenance.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Consistent naming:</strong> Use standardized file naming conventions (e.g., YYYY-MM-DD_dataset_version)</li>
              <li>• <strong>Version control:</strong> Track data versions and maintain change logs</li>
              <li>• <strong>Metadata tags:</strong> Use descriptive tags for easy searching and categorization</li>
              <li>• <strong>Clean up regularly:</strong> Remove outdated or duplicate files to maintain organization</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Quality & Validation</h2>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">Data Quality Checklist</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Before Processing</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Validate data schema and structure</li>
                <li>✓ Check for missing or null values</li>
                <li>✓ Identify and handle outliers</li>
                <li>✓ Verify data freshness and completeness</li>
                <li>✓ Assess data quality metrics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">During Processing</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Monitor processing performance</li>
                <li>✓ Validate transformation results</li>
                <li>✓ Check for data drift or anomalies</li>
                <li>✓ Ensure consistent data types</li>
                <li>✓ Maintain audit trails</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
          <h3 className="font-semibold mb-3">Automated Validation</h3>
          <p className="text-gray-700 mb-4">
            Implement automated data validation checks to catch issues early and maintain data quality standards.
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Set up data quality rules and thresholds</li>
            <li>• Configure automated alerts for quality violations</li>
            <li>• Use statistical tests for data distribution monitoring</li>
            <li>• Implement schema validation for incoming data</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Performance Optimization</h2>
        
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Processing Efficiency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3 text-green-700">✓ Do</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Use appropriate file formats (Parquet for analytics)</li>
                  <li>• Process data in batches for large datasets</li>
                  <li>• Leverage caching for frequently accessed data</li>
                  <li>• Use column selection to reduce memory usage</li>
                  <li>• Implement parallel processing where possible</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-red-700">✗ Avoid</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Loading entire datasets into memory unnecessarily</li>
                  <li>• Performing complex operations on raw data</li>
                  <li>• Using inefficient file formats for large data</li>
                  <li>• Ignoring memory and CPU resource limits</li>
                  <li>• Processing data without sampling first</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-400 p-6">
            <h3 className="font-semibold mb-3">Scalability Planning</h3>
            <p className="text-gray-700 mb-4">
              Design your data pipelines with scalability in mind to handle growing data volumes and complexity.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Design for horizontal scaling from the start</li>
              <li>• Use distributed processing for large datasets</li>
              <li>• Implement data partitioning strategies</li>
              <li>• Monitor resource usage and set up auto-scaling</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Security & Privacy</h2>
        
        <div className="space-y-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Data Protection</h3>
            <p className="text-gray-700 mb-4">
              Implement comprehensive data protection measures throughout your ML pipeline.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Encryption:</strong> Enable encryption at rest and in transit for all sensitive data</li>
              <li>• <strong>Access Control:</strong> Implement role-based access control with principle of least privilege</li>
              <li>• <strong>PII Handling:</strong> Use automated PII detection and appropriate masking techniques</li>
              <li>• <strong>Audit Logging:</strong> Enable comprehensive logging for all data access and modifications</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
            <h3 className="font-semibold mb-3">Compliance Considerations</h3>
            <p className="text-gray-700 mb-4">
              Ensure your data processing practices align with relevant regulatory requirements.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Understand data residency and sovereignty requirements</li>
              <li>• Implement data retention and deletion policies</li>
              <li>• Maintain documentation for compliance audits</li>
              <li>• Regular security assessments and updates</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">ML Model Management</h2>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">Model Lifecycle</h3>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="bg-blue-100 rounded-full p-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
              <div>
                <h4 className="font-medium text-sm">Development & Training</h4>
                <p className="text-xs text-gray-600">Use feature stores, maintain training data lineage, implement proper validation</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-green-100 rounded-full p-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <div>
                <h4 className="font-medium text-sm">Deployment & Serving</h4>
                <p className="text-xs text-gray-600">Implement A/B testing, gradual rollouts, and performance monitoring</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-purple-100 rounded-full p-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
              </div>
              <div>
                <h4 className="font-medium text-sm">Monitoring & Maintenance</h4>
                <p className="text-xs text-gray-600">Track model performance, data drift, and retrain as needed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-6">
          <h3 className="font-semibold mb-3">Reproducibility</h3>
          <p className="text-gray-700 mb-4">
            Ensure your ML experiments and models are reproducible and version controlled.
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Version all datasets, features, and model artifacts</li>
            <li>• Document hyperparameters and training configurations</li>
            <li>• Use containerization for consistent environments</li>
            <li>• Maintain experiment tracking and metadata</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Monitoring & Observability</h2>
        
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Key Metrics to Track</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded p-4">
              <h4 className="font-medium mb-3">Data Quality</h4>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• Completeness rates</li>
                <li>• Schema validation errors</li>
                <li>• Data freshness metrics</li>
                <li>• Anomaly detection alerts</li>
              </ul>
            </div>
            <div className="bg-white border border-gray-200 rounded p-4">
              <h4 className="font-medium mb-3">Pipeline Performance</h4>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• Processing latency</li>
                <li>• Throughput metrics</li>
                <li>• Resource utilization</li>
                <li>• Error rates and failures</li>
              </ul>
            </div>
            <div className="bg-white border border-gray-200 rounded p-4">
              <h4 className="font-medium mb-3">Model Performance</h4>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• Accuracy and precision</li>
                <li>• Prediction latency</li>
                <li>• Data drift detection</li>
                <li>• Business impact metrics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Collaboration & Documentation</h2>
        
        <div className="space-y-6">
          <div className="bg-teal-50 border-l-4 border-teal-400 p-6">
            <h3 className="font-semibold mb-3">Team Collaboration</h3>
            <p className="text-gray-700 mb-4">
              Foster effective collaboration across data science, engineering, and business teams.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Use shared investigations for team projects</li>
              <li>• Implement code review processes for data transformations</li>
              <li>• Establish clear handoff procedures between teams</li>
              <li>• Create shared documentation and knowledge bases</li>
            </ul>
          </div>

          <div className="bg-orange-50 border-l-4 border-orange-400 p-6">
            <h3 className="font-semibold mb-3">Documentation Standards</h3>
            <p className="text-gray-700 mb-4">
              Maintain comprehensive documentation for all data processes and decisions.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Document data sources, transformations, and business logic</li>
              <li>• Maintain data dictionaries and schema documentation</li>
              <li>• Record decisions and rationale for modeling choices</li>
              <li>• Keep runbooks for operational procedures</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}