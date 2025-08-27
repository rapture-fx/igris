import { ApiLayout } from '@/components/ui/ApiLayout'

export default function DataQualityApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Assess data quality
curl -X POST https://api.schlep-engine.com/api/v1/quality/assess \
  -H "Authorization: Bearer sk_your_api_key" \
  -F "file=@/path/to/your/file.csv"`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}
files = {'file': open('/path/to/your/file.csv', 'rb')}

response = requests.post("https://api.schlep-engine.com/api/v1/quality/assess", headers=headers, files=files)
print(response.json())`
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
      title="Data Quality API"
      description="Assess, clean, and engineer your data for AI-readiness."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="assess-data-quality">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Assess Data Quality</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/quality/assess</code>
          </div>
          <p className="text-gray-600 mb-4">Comprehensive data quality assessment for AI-ready datasets.</p>
        </div>
      </section>

      <section className="mb-12" id="auto-clean-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Auto Clean Data</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/quality/clean/auto</code>
          </div>
          <p className="text-gray-600 mb-4">Automated data cleaning with intelligent missing value imputation, outlier detection, and duplicate removal.</p>
        </div>
      </section>

      <section className="mb-12" id="ai-feature-engineering">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI Feature Engineering</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/quality/feature-engineering</code>
          </div>
          <p className="text-gray-600 mb-4">AI-powered feature engineering for machine learning readiness.</p>
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