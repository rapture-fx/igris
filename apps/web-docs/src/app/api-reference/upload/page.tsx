import { EndpointCard } from '@/components/EndpointCard'

export default function UploadApiPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Data Upload API</h1>
        <p className="text-xl text-gray-600">
          Upload files and connect data sources to the Schlep Engine platform.
        </p>
      </div>

      <div className="space-y-8">
        <EndpointCard
          method="POST"
          path="/upload"
          title="Upload File"
          description="Upload a data file (CSV, JSON, Excel) for processing. Returns an upload ID that can be used to track the file and start processing jobs."
          parameters={[
            {
              name: "file",
              type: "file",
              required: true,
              description: "The data file to upload. Supported formats: CSV, JSON, Excel (.xlsx, .xls)",
              example: "customer_data.csv"
            },
            {
              name: "name",
              type: "string",
              required: false,
              description: "Optional name for the upload. If not provided, the filename will be used.",
              example: "Customer Data Q4 2023"
            },
            {
              name: "tags",
              type: "array",
              required: false,
              description: "Optional tags to categorize the upload",
              example: "[\"customer\", \"sales\", \"q4\"]"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "File uploaded successfully",
              example: `{
  "success": true,
  "data": {
    "upload_id": "upload_1234567890",
    "filename": "customer_data.csv",
    "size": 1048576,
    "format": "csv",
    "rows": 10000,
    "columns": 15,
    "status": "uploaded",
    "created_at": "2024-01-15T10:30:00Z",
    "expires_at": "2024-01-22T10:30:00Z"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789",
    "processing_time_ms": 1250
  }
}`
            },
            {
              status: 400,
              description: "Invalid file format or corrupted file",
              example: `{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Invalid file format. Supported formats: CSV, JSON, Excel",
    "code": "invalid_file_format",
    "details": {
      "provided_format": "txt",
      "supported_formats": ["csv", "json", "xlsx", "xls"]
    }
  }
}`
            },
            {
              status: 413,
              description: "File too large",
              example: `{
  "success": false,
  "error": {
    "type": "file_too_large",
    "message": "File size exceeds maximum limit of 100MB",
    "code": "file_size_exceeded",
    "details": {
      "file_size": 104857600,
      "max_size": 104857600
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/upload \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -F "file=@customer_data.csv" \\
  -F "name=Customer Data Q4 2023" \\
  -F "tags=[\"customer\", \"sales\", \"q4\"]"`,
            python: `import requests

# Upload file
with open('customer_data.csv', 'rb') as f:
    response = requests.post(
        'https://api.schlepengine.com/v1/upload',
        headers={
            'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
        },
        files={'file': f},
        data={
            'name': 'Customer Data Q4 2023',
            'tags': '["customer", "sales", "q4"]'
        }
    )

if response.status_code == 200:
    upload_data = response.json()
    upload_id = upload_data['data']['upload_id']
    print(f"Upload successful! ID: {upload_id}")
else:
    print(f"Upload failed: {response.text}")`,
            javascript: `const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'Customer Data Q4 2023');
formData.append('tags', '["customer", "sales", "q4"]');

fetch('https://api.schlepengine.com/v1/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  },
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Upload successful!', data.data.upload_id);
  } else {
    console.error('Upload failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/uploads"
          title="List Uploads"
          description="Get a list of all uploaded files with their status and metadata."
          parameters={[
            {
              name: "limit",
              type: "integer",
              required: false,
              description: "Maximum number of uploads to return (default: 50, max: 100)",
              example: "50"
            },
            {
              name: "offset",
              type: "integer",
              required: false,
              description: "Number of uploads to skip for pagination",
              example: "0"
            },
            {
              name: "status",
              type: "string",
              required: false,
              description: "Filter by upload status: uploaded, processing, completed, failed",
              example: "completed"
            },
            {
              name: "tags",
              type: "string",
              required: false,
              description: "Filter by tags (comma-separated)",
              example: "customer,sales"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "List of uploads retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "uploads": [
      {
        "upload_id": "upload_1234567890",
        "filename": "customer_data.csv",
        "name": "Customer Data Q4 2023",
        "size": 1048576,
        "format": "csv",
        "rows": 10000,
        "columns": 15,
        "status": "completed",
        "tags": ["customer", "sales", "q4"],
        "created_at": "2024-01-15T10:30:00Z",
        "expires_at": "2024-01-22T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 127,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlepengine.com/v1/uploads?limit=10&status=completed" \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/uploads',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'limit': 10,
        'status': 'completed',
        'tags': 'customer,sales'
    }
)

uploads = response.json()['data']['uploads']
for upload in uploads:
    print(f"{upload['filename']} - {upload['status']}")`,
            javascript: `const params = new URLSearchParams({
  limit: '10',
  status: 'completed',
  tags: 'customer,sales'
});

fetch(\`https://api.schlepengine.com/v1/uploads?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  data.data.uploads.forEach(upload => {
    console.log(\`\${upload.filename} - \${upload.status}\`);
  });
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/uploads/{upload_id}"
          title="Get Upload Details"
          description="Get detailed information about a specific upload including metadata, status, and file information."
          parameters={[
            {
              name: "upload_id",
              type: "string",
              required: true,
              description: "The unique identifier of the upload",
              example: "upload_1234567890"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Upload details retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "upload_id": "upload_1234567890",
    "filename": "customer_data.csv",
    "name": "Customer Data Q4 2023",
    "size": 1048576,
    "format": "csv",
    "rows": 10000,
    "columns": 15,
    "status": "completed",
    "tags": ["customer", "sales", "q4"],
    "created_at": "2024-01-15T10:30:00Z",
    "expires_at": "2024-01-22T10:30:00Z",
    "metadata": {
      "encoding": "utf-8",
      "delimiter": ",",
      "has_header": true,
      "file_hash": "sha256:abc123def456"
    }
  }
}`
            },
            {
              status: 404,
              description: "Upload not found",
              example: `{
  "success": false,
  "error": {
    "type": "not_found",
    "message": "Upload not found",
    "code": "upload_not_found"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlepengine.com/v1/uploads/upload_1234567890 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/uploads/upload_1234567890',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    upload = response.json()['data']
    print(f"File: {upload['filename']}")
    print(f"Status: {upload['status']}")
    print(f"Rows: {upload['rows']}")
    print(f"Columns: {upload['columns']}")
else:
    print(f"Error: {response.text}")`,
            javascript: `fetch('https://api.schlepengine.com/v1/uploads/upload_1234567890', {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const upload = data.data;
    console.log(\`File: \${upload.filename}\`);
    console.log(\`Status: \${upload.status}\`);
    console.log(\`Rows: \${upload.rows}\`);
    console.log(\`Columns: \${upload.columns}\`);
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="DELETE"
          path="/uploads/{upload_id}"
          title="Delete Upload"
          description="Permanently delete an uploaded file and all associated data. This action cannot be undone."
          parameters={[
            {
              name: "upload_id",
              type: "string",
              required: true,
              description: "The unique identifier of the upload to delete",
              example: "upload_1234567890"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Upload deleted successfully",
              example: `{
  "success": true,
  "data": {
    "upload_id": "upload_1234567890",
    "deleted_at": "2024-01-15T10:30:00Z",
    "message": "Upload and all associated data deleted successfully"
  }
}`
            },
            {
              status: 404,
              description: "Upload not found",
              example: `{
  "success": false,
  "error": {
    "type": "not_found",
    "message": "Upload not found",
    "code": "upload_not_found"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X DELETE https://api.schlepengine.com/v1/uploads/upload_1234567890 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.delete(
    'https://api.schlepengine.com/v1/uploads/upload_1234567890',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    print("Upload deleted successfully")
else:
    print(f"Error: {response.text}")`,
            javascript: `fetch('https://api.schlepengine.com/v1/uploads/upload_1234567890', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Upload deleted successfully');
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />
      </div>
    </div>
  )
}