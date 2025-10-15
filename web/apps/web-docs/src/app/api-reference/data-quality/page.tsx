import { ApiLayout } from '@/components/ui/ApiLayout'

export default function DataQualityApiPage() {

  return (
    <ApiLayout 
      title="Industrial Data Quality API"
      description="Multi-modal anomaly detection and sensor validation for manufacturing data."
    >
      <section className="mb-12" id="assess-data-quality">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Industrial Quality Assessment</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/data-quality/assess</code>
          </div>
          <p className="text-gray-600 mb-4">Multi-modal anomaly detection using IsolationForest, OneClassSVM, DBSCAN for industrial sensor data.</p>
        </div>
      </section>

      <section className="mb-12" id="auto-clean-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sensor Validation</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/data-processing/validate-sensors</code>
          </div>
          <p className="text-gray-600 mb-4">Statistical validation of sensor readings with cross-sensor correlation analysis and drift detection.</p>
        </div>
      </section>

      <section className="mb-12" id="ai-feature-engineering">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Equipment Health Assessment</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/monitoring/equipment-health</code>
          </div>
          <p className="text-gray-600 mb-4">Real-time equipment health monitoring with statistical process control and pattern detection.</p>
        </div>
      </section>

      <section className="mb-12" id="list-assessments">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Assessments</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/quality/assessments</code>
          </div>
          <p className="text-gray-600 mb-4">List all data quality assessments for the authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="download-processed-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Download Processed Data</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/quality/download/{'{processing_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Download processed or cleaned data.</p>
        </div>
      </section>
    </ApiLayout>
  )
}