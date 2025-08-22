import { ApiLayout } from '@/components/ui/ApiLayout'

export default function DocumentExtractionApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Extract data from a PDF file
curl -X POST https://api.schlep-engine.com/api/v1/extraction/extract/pdf \
  -H "Authorization: Bearer sk_your_api_key" \
  -F "file=@/path/to/your/file.pdf"`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}
files = {'file': open('/path/to/your/file.pdf', 'rb')}

response = requests.post("https://api.schlep-engine.com/api/v1/extraction/extract/pdf", headers=headers, files=files)
print(response.json())`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';
const fileInput = document.querySelector('input[type="file"]');

const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('https://api.schlep-engine.com/api/v1/extraction/extract/pdf', {
  method: 'POST',
  headers: {
    'Authorization': 
    'Bearer ' + apiKey
  },
  body: formData
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Document Extraction API"
      description="Extract data from PDFs, DOCX, Excel, and scanned documents."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="extract-pdf-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Extract PDF Data</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/extraction/extract/pdf</code>
          </div>
          <p className="text-gray-600 mb-4">Extract tables and data from PDF files.</p>
        </div>
      </section>

      <section className="mb-12" id="extract-document-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Extract Document Data</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/extraction/extract/documents</code>
          </div>
          <p className="text-gray-600 mb-4">Extract tables and data from DOCX and Excel files.</p>
        </div>
      </section>

      <section className="mb-12" id="extract-ocr-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Extract OCR Data</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/extraction/extract/ocr</code>
          </div>
          <p className="text-gray-600 mb-4">Extract data from scanned documents using OCR.</p>
        </div>
      </section>

      <section className="mb-12" id="list-extractions">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Extractions</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/extraction/extractions</code>
          </div>
          <p className="text-gray-600 mb-4">List all document extractions for the authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="get-extraction">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Extraction</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/extraction/extractions/{'{extraction_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Get the results of a specific document extraction.</p>
        </div>
      </section>
    </ApiLayout>
  )
}