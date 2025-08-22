import { ApiLayout } from '@/components/ui/ApiLayout'

export default function DataProcessingApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Create a new data investigation
curl -X POST https://api.schlep-engine.com/api/v1/data-processing/investigations/ \
  -H \"Authorization: Bearer sk_your_api_key\" \
  -H \"Content-Type: application/json\" \
  -d '{
    \"name\": \"Customer Data Analysis\",
    \"description\": \"Analysis of customer behavior data\",
    \"workspace_id\": \"ws_123456789\"
  }

# Upload file to investigation  
curl -X POST \"https://api.schlep-engine.com/api/v1/data-processing/investigations/{investigation_id}/files/\" \
  -H \"Authorization: Bearer sk_your_api_key\" \
  -F \"file=@customer_data.csv\" \
  -F \"file_type=dataset\"`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = \"sk_your_api_key\"
headers = {\"Authorization\": f\"Bearer {api_key}\"}

investigation_data = {
    \"workspace_id\": \"your_workspace_id\"
}

response = requests.post(\"https://api.schlep-engine.com/api/v1/processing/investigations/\", headers=headers, json=investigation_data)
print(response.json())`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';

const investigationData = {
    workspace_id: \"your_workspace_id\"
};

fetch('https://api.schlep-engine.com/api/v1/processing/investigations/', {
  method: 'POST',
  headers: {
    'Authorization': \
`Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(investigationData)
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Data Processing API"
      description="Manage data investigations and processing jobs."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="create-investigation">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Investigation</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/processing/investigations/</code>
          </div>
          <p className="text-gray-600 mb-4">Create a new data investigation.</p>
        </div>
      </section>

      <section className="mb-12" id="list-investigations">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Investigations</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/processing/investigations/</code>
          </div>
          <p className="text-gray-600 mb-4">List all data investigations.</p>
        </div>
      </section>

      <section className="mb-12" id="get-investigation">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Investigation</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/processing/investigations/{{'{investigation_id}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Get a specific data investigation by ID.</p>
        </div>
      </section>

      <section className="mb-12" id="update-investigation">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Update Investigation</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-200 text-orange-800">PUT</span>
            <code className="text-sm">/api/v1/processing/investigations/{{'{investigation_id}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Update a data investigation.</p>
        </div>
      </section>

      <section className="mb-12" id="delete-investigation">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete Investigation</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/processing/investigations/{{'{investigation_id}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Delete a data investigation.</p>
        </div>
      </section>

      <section className="mb-12" id="create-job">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Job</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/processing/jobs/</code>
          </div>
          <p className="text-gray-600 mb-4">Create a new processing job for a data investigation.</p>
        </div>
      </section>

      <section className="mb-12" id="list-jobs">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Jobs</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/processing/investigations/{{'{investigation_id}'}}/jobs/</code>
          </div>
          <p className="text-gray-600 mb-4">List all processing jobs for a specific data investigation.</p>
        </div>
      </section>

      <section className="mb-12" id="get-job">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Job</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/processing/jobs/{{'{job_id}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Get a specific processing job by ID.</p>
        </div>
      </section>

      <section className="mb-12" id="update-job">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Update Job</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-200 text-orange-800">PUT</span>
            <code className="text-sm">/api/v1/processing/jobs/{{'{job_id}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Update a processing job.</p>
        </div>
      </section>

      <section className="mb-12" id="delete-job">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete Job</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/processing/jobs/{{'{job_id}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Delete a processing job.</p>
        </div>
      </section>
    </ApiLayout>
  )
}
