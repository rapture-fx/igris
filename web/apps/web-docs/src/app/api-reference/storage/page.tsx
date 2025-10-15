import { ApiLayout } from '@/components/ui/ApiLayout'

export default function StorageApiPage() {

  return (
    <ApiLayout 
      title="Storage API"
      description="Manage files, folders, and storage quotas."
    >
      <section className="mb-12" id="upload-file">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Upload File</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/storage/upload</code>
          </div>
          <p className="text-gray-600 mb-4">Upload a file to the storage.</p>
        </div>
      </section>

      <section className="mb-12" id="list-files">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Files</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/storage/files</code>
          </div>
          <p className="text-gray-600 mb-4">List all files for the authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="get-file-metadata">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get File Metadata</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/storage/files/{'{file_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Get the metadata for a specific file.</p>
        </div>
      </section>

      <section className="mb-12" id="download-file">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Download File</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/storage/download/{'{file_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Download a specific file.</p>
        </div>
      </section>

      <section className="mb-12" id="delete-file">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete File</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/storage/files/{'{file_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Delete a specific file.</p>
        </div>
      </section>

      <section className="mb-12" id="share-file">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Share File</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/storage/files/{'{file_id}'}/share</code>
          </div>
          <p className="text-gray-600 mb-4">Create a shareable link for a file.</p>
        </div>
      </section>

      <section className="mb-12" id="get-quota">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Quota</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/storage/quota</code>
          </div>
          <p className="text-gray-600 mb-4">Get the storage quota for the authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="create-folder">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Folder</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/storage/folders</code>
          </div>
          <p className="text-gray-600 mb-4">Create a new folder.</p>
        </div>
      </section>
    </ApiLayout>
  )
}