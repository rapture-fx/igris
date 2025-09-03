import { ApiLayout } from '@/components/ui/ApiLayout'

export default function DataQualityApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Industrial sensor quality assessment
curl -X POST https://api.schlep-engine.com/api/v1/data-quality/assess \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_data": {
      "temperature_sensor_1": [22.5, 23.1, 22.8, 95.2, 24.2],
      "pressure_sensor_1": [101.3, 101.5, 101.2, 180.8, 101.8],
      "vibration_sensor_1": [0.1, 0.15, 0.12, 0.18, 0.14]
    },
    "sensor_metadata": {
      "temperature_sensor_1": {"min_value": -40, "max_value": 150},
      "pressure_sensor_1": {"min_value": 0, "max_value": 100}
    }
  }'`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests
import json

api_key = "sk_your_api_key"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Industrial sensor data with known anomalies
data = {
    "sensor_data": {
        "temperature_sensor_1": [22.5, 23.1, 22.8, 95.2, 24.2],  # 95.2 is anomalous
        "pressure_sensor_1": [101.3, 101.5, 101.2, 180.8, 101.8],  # 180.8 is anomalous
        "vibration_sensor_1": [0.1, 0.15, 0.12, 0.18, 0.14]
    },
    "sensor_metadata": {
        "temperature_sensor_1": {"min_value": -40, "max_value": 150},
        "pressure_sensor_1": {"min_value": 0, "max_value": 100}
    }
}

response = requests.post(
    "https://api.schlep-engine.com/api/v1/data-quality/assess", 
    headers=headers, 
    data=json.dumps(data)
)

result = response.json()
print(f"Anomalies detected: {result['anomaly_detection']['total_anomalies_detected']}")
print(f"Methods used: {result['anomaly_detection']['anomaly_methods']}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';
const fileInput = document.querySelector('input[type="file"]');

const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('https://api.schlep-engine.com/api/v1/quality/assess', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: formData
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Industrial Data Quality API"
      description="Multi-modal anomaly detection and sensor validation for manufacturing data."
      codeExamples={codeExamples}
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