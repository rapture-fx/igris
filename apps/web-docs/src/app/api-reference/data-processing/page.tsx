import { EndpointCard } from '@/components/ui/EndpointCard'

export default function DataProcessingApiPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Data Processing API</h1>
        <p className="text-xl text-gray-600">
          Comprehensive data processing pipeline with AI-powered transformations, quality assessment, and document extraction.
        </p>
      </div>

      <div className="space-y-8">
        <EndpointCard
          method="POST"
          path="/data-processing/processing/investigations/"
          title="Create Data Investigation"
          description="Create a new data investigation to analyze uploaded datasets. This initiates the AI-powered data profiling and quality assessment process."
          parameters={[
            {
              name: "workspace_id",
              type: "string",
              required: true,
              description: "UUID of the workspace to associate the investigation with",
              example: "550e8400-e29b-41d4-a716-446655440000"
            },
            {
              name: "name",
              type: "string",
              required: true,
              description: "Human-readable name for the investigation",
              example: "Customer Data Quality Analysis"
            },
            {
              name: "description",
              type: "string",
              required: false,
              description: "Optional description of the investigation goals",
              example: "Analyzing customer data quality before ML training"
            },
            {
              name: "original_file_path",
              type: "string",
              required: false,
              description: "Path to the original uploaded file",
              example: "/uploads/customer_data_2024.csv"
            }
          ]}
          responses={[
            {
              status: 201,
              description: "Data investigation created successfully",
              example: `{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Customer Data Quality Analysis",
  "description": "Analyzing customer data quality before ML training",
  "status": "created",
  "original_file_path": "/uploads/customer_data_2024.csv",
  "created_at": "2024-01-15T10:30:00Z",
  "created_by_id": "user_123456789"
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/data-processing/processing/investigations/ \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Customer Data Quality Analysis",
    "description": "Analyzing customer data quality before ML training",
    "original_file_path": "/uploads/customer_data_2024.csv"
  }'`,
            python: `import requests

investigation_data = {
    'workspace_id': '550e8400-e29b-41d4-a716-446655440000',
    'name': 'Customer Data Quality Analysis',
    'description': 'Analyzing customer data quality before ML training',
    'original_file_path': '/uploads/customer_data_2024.csv'
}

response = requests.post(
    'https://api.schlepengine.com/v1/data-processing/processing/investigations/',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json=investigation_data
)

if response.status_code == 201:
    investigation = response.json()
    print(f"Investigation created: {investigation['id']}")
    print(f"Status: {investigation['status']}")
else:
    print(f"Error: {response.text}")`,
            javascript: `const investigationData = {
  workspace_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Customer Data Quality Analysis',
  description: 'Analyzing customer data quality before ML training',
  original_file_path: '/uploads/customer_data_2024.csv'
};

fetch('https://api.schlepengine.com/v1/data-processing/processing/investigations/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(investigationData)
})
.then(response => response.json())
.then(investigation => {
  console.log(\`Investigation created: \${investigation.id}\`);
  console.log(\`Status: \${investigation.status}\`);
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="POST"
          path="/data-processing/processing/jobs/"
          title="Create Processing Job"
          description="Create a new processing job for a data investigation. This dispatches work to AI workers for schema detection, quality analysis, or data transformations."
          parameters={[
            {
              name: "investigation_id",
              type: "string",
              required: true,
              description: "UUID of the parent data investigation",
              example: "550e8400-e29b-41d4-a716-446655440001"
            },
            {
              name: "job_type",
              type: "string",
              required: true,
              description: "Type of processing job: schema_detection, quality_analysis, data_transformation",
              example: "schema_detection"
            },
            {
              name: "configuration",
              type: "object",
              required: false,
              description: "Job-specific configuration parameters",
              example: `{"detect_pii": true, "sample_size": 10000}`
            }
          ]}
          responses={[
            {
              status: 201,
              description: "Processing job created and dispatched successfully",
              example: `{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "investigation_id": "550e8400-e29b-41d4-a716-446655440001",
  "job_type": "schema_detection",
  "status": "PENDING",
  "configuration": {
    "detect_pii": true,
    "sample_size": 10000
  },
  "created_at": "2024-01-15T10:30:00Z",
  "started_at": null,
  "completed_at": null,
  "error_message": null,
  "results": null
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/data-processing/processing/jobs/ \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "investigation_id": "550e8400-e29b-41d4-a716-446655440001",
    "job_type": "schema_detection",
    "configuration": {
      "detect_pii": true,
      "sample_size": 10000
    }
  }'`,
            python: `import requests

job_data = {
    'investigation_id': '550e8400-e29b-41d4-a716-446655440001',
    'job_type': 'schema_detection',
    'configuration': {
        'detect_pii': True,
        'sample_size': 10000
    }
}

response = requests.post(
    'https://api.schlepengine.com/v1/data-processing/processing/jobs/',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json=job_data
)

if response.status_code == 201:
    job = response.json()
    print(f"Job created: {job['id']}")
    print(f"Type: {job['job_type']}")
    print(f"Status: {job['status']}")
else:
    print(f"Error: {response.text}")`,
            javascript: `const jobData = {
  investigation_id: '550e8400-e29b-41d4-a716-446655440001',
  job_type: 'schema_detection',
  configuration: {
    detect_pii: true,
    sample_size: 10000
  }
};

fetch('https://api.schlepengine.com/v1/data-processing/processing/jobs/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(jobData)
})
.then(response => response.json())
.then(job => {
  console.log(\`Job created: \${job.id}\`);
  console.log(\`Type: \${job.job_type}\`);
  console.log(\`Status: \${job.status}\`);
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="POST"
          path="/data-processing/extraction/extract/pdf"
          title="Extract PDF Data"
          description="Extract tables and structured data from PDF files using AI-powered document processing. Supports table detection, text extraction, and OCR."
          parameters={[
            {
              name: "file",
              type: "file",
              required: true,
              description: "PDF file to process (max 50MB)",
              example: "financial_report.pdf"
            },
            {
              name: "request_data",
              type: "string",
              required: false,
              description: "JSON configuration for extraction options",
              example: `{"extract_tables": true, "extract_text": false, "detect_structure": true, "output_format": "json"}`
            }
          ]}
          responses={[
            {
              status: 200,
              description: "PDF data extracted successfully",
              example: `{
  "success": true,
  "extraction_id": "550e8400-e29b-41d4-a716-446655440003",
  "filename": "financial_report.pdf",
  "file_type": "pdf",
  "tables": [
    {
      "table_id": "page_1_table_1",
      "page_number": 1,
      "headers": ["Quarter", "Revenue", "Profit", "Expenses"],
      "rows": [
        ["Q1 2024", "$125,000", "$45,000", "$80,000"],
        ["Q2 2024", "$150,000", "$60,000", "$90,000"]
      ],
      "confidence": 0.94,
      "row_count": 2,
      "column_count": 4
    }
  ],
  "text_content": null,
  "metadata": {
    "pages": 3,
    "tables_found": 1,
    "file_size_bytes": 1048576,
    "extraction_method": "pdfplumber",
    "detected_encoding": "utf-8",
    "text_length": 0,
    "processing_time_seconds": 2.45
  },
  "processing_time": 2.45
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/data-processing/extraction/extract/pdf \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -F "file=@financial_report.pdf" \\
  -F 'request_data={"extract_tables": true, "extract_text": false, "detect_structure": true, "output_format": "json"}'`,
            python: `import requests

# Extract tables from PDF
with open('financial_report.pdf', 'rb') as pdf_file:
    response = requests.post(
        'https://api.schlepengine.com/v1/data-processing/extraction/extract/pdf',
        headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
        files={'file': pdf_file},
        data={
            'request_data': '{"extract_tables": true, "extract_text": false, "detect_structure": true, "output_format": "json"}'
        }
    )

if response.status_code == 200:
    result = response.json()
    print(f"Extraction ID: {result['extraction_id']}")
    print(f"Processing time: {result['processing_time']:.2f}s")
    print(f"Tables found: {len(result['tables'])}")
    
    for table in result['tables']:
        print(f"\\nTable {table['table_id']} (confidence: {table['confidence']:.2f}):")
        print(f"Headers: {table['headers']}")
        print(f"Rows: {table['row_count']}, Columns: {table['column_count']}")
else:
    print(f"Error: {response.text}")`,
            javascript: `const formData = new FormData();
formData.append('file', pdfFileInput.files[0]);
formData.append('request_data', JSON.stringify({
  extract_tables: true,
  extract_text: false,
  detect_structure: true,
  output_format: 'json'
}));

fetch('https://api.schlepengine.com/v1/data-processing/extraction/extract/pdf', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  },
  body: formData
})
.then(response => response.json())
.then(result => {
  console.log(\`Extraction ID: \${result.extraction_id}\`);
  console.log(\`Processing time: \${result.processing_time.toFixed(2)}s\`);
  console.log(\`Tables found: \${result.tables.length}\`);
  
  result.tables.forEach(table => {
    console.log(\`\\nTable \${table.table_id} (confidence: \${table.confidence.toFixed(2)}):\`);
    console.log(\`Headers: \${table.headers.join(', ')}\`);
    console.log(\`Rows: \${table.row_count}, Columns: \${table.column_count}\`);
  });
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="GET"
          path="/data-processing/processing/investigations/{investigation_id}/jobs/"
          title="List Processing Jobs"
          description="Get all processing jobs for a specific data investigation, including their status, results, and error information."
          parameters={[
            {
              name: "investigation_id",
              type: "string",
              required: true,
              description: "UUID of the data investigation",
              example: "550e8400-e29b-41d4-a716-446655440001"
            },
            {
              name: "skip",
              type: "integer",
              required: false,
              description: "Number of jobs to skip for pagination (default: 0)",
              example: "0"
            },
            {
              name: "limit",
              type: "integer",
              required: false,
              description: "Maximum number of jobs to return (default: 100)",
              example: "100"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Processing jobs retrieved successfully",
              example: `[
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "investigation_id": "550e8400-e29b-41d4-a716-446655440001",
    "job_type": "schema_detection",
    "status": "COMPLETED",
    "configuration": {
      "detect_pii": true,
      "sample_size": 10000
    },
    "created_at": "2024-01-15T10:30:00Z",
    "started_at": "2024-01-15T10:30:05Z",
    "completed_at": "2024-01-15T10:32:15Z",
    "error_message": null,
    "results": {
      "schema": {
        "customer_id": {"type": "integer", "nullable": false, "pii": false},
        "email": {"type": "string", "nullable": false, "pii": true},
        "phone": {"type": "string", "nullable": true, "pii": true},
        "purchase_amount": {"type": "decimal", "nullable": false, "pii": false}
      },
      "quality_score": 94.2,
      "total_rows": 45000,
      "null_percentage": 2.1,
      "duplicate_percentage": 0.3
    }
  }
]`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlepengine.com/v1/data-processing/processing/investigations/550e8400-e29b-41d4-a716-446655440001/jobs/?skip=0&limit=10" \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/data-processing/processing/investigations/550e8400-e29b-41d4-a716-446655440001/jobs/',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    params={'skip': 0, 'limit': 10}
)

if response.status_code == 200:
    jobs = response.json()
    print(f"Found {len(jobs)} processing jobs:")
    
    for job in jobs:
        print(f"\\nJob {job['id'][:8]}...")
        print(f"Type: {job['job_type']}")
        print(f"Status: {job['status']}")
        
        if job['status'] == 'COMPLETED' and job['results']:
            results = job['results']
            if 'quality_score' in results:
                print(f"Quality Score: {results['quality_score']:.1f}%")
            if 'total_rows' in results:
                print(f"Total Rows: {results['total_rows']:,}")
else:
    print(f"Error: {response.text}")`,
            javascript: `const params = new URLSearchParams({
  skip: '0',
  limit: '10'
});

fetch(\`https://api.schlepengine.com/v1/data-processing/processing/investigations/550e8400-e29b-41d4-a716-446655440001/jobs/?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(jobs => {
  console.log(\`Found \${jobs.length} processing jobs:\`);
  
  jobs.forEach(job => {
    console.log(\`\\nJob \${job.id.substring(0, 8)}...\`);
    console.log(\`Type: \${job.job_type}\`);
    console.log(\`Status: \${job.status}\`);
    
    if (job.status === 'COMPLETED' && job.results) {
      const results = job.results;
      if (results.quality_score) {
        console.log(\`Quality Score: \${results.quality_score.toFixed(1)}%\`);
      }
      if (results.total_rows) {
        console.log(\`Total Rows: \${results.total_rows.toLocaleString()}\`);
      }
    }
  });
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="GET"
          path="/data-processing/processing/jobs/{job_id}"
          title="Get Processing Job Details"
          description="Get detailed information about a specific processing job including results, configuration, and execution timeline."
          parameters={[
            {
              name: "job_id",
              type: "string",
              required: true,
              description: "UUID of the processing job",
              example: "550e8400-e29b-41d4-a716-446655440002"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Processing job details retrieved successfully",
              example: `{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "investigation_id": "550e8400-e29b-41d4-a716-446655440001",
  "job_type": "schema_detection",
  "status": "COMPLETED",
  "configuration": {
    "detect_pii": true,
    "sample_size": 10000
  },
  "created_at": "2024-01-15T10:30:00Z",
  "started_at": "2024-01-15T10:30:05Z",
  "completed_at": "2024-01-15T10:32:15Z",
  "error_message": null,
  "results": {
    "schema": {
      "customer_id": {
        "type": "integer",
        "nullable": false,
        "pii": false,
        "unique_values": 45000,
        "min_value": 1,
        "max_value": 45000
      },
      "email": {
        "type": "string",
        "nullable": false,
        "pii": true,
        "unique_values": 44987,
        "pattern": "email",
        "validation_errors": 13
      },
      "phone": {
        "type": "string",
        "nullable": true,
        "pii": true,
        "unique_values": 39456,
        "pattern": "phone",
        "null_count": 5544
      },
      "purchase_amount": {
        "type": "decimal",
        "nullable": false,
        "pii": false,
        "min_value": 0.01,
        "max_value": 9999.99,
        "average": 157.34
      }
    },
    "quality_score": 94.2,
    "total_rows": 45000,
    "null_percentage": 2.1,
    "duplicate_percentage": 0.3,
    "pii_fields": ["email", "phone"],
    "data_issues": [
      "13 invalid email formats detected",
      "5,544 missing phone numbers (12.3%)"
    ],
    "recommendations": [
      "Consider data validation for email field",
      "Phone field has high null rate - investigate if optional"
    ]
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlepengine.com/v1/data-processing/processing/jobs/550e8400-e29b-41d4-a716-446655440002 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/data-processing/processing/jobs/550e8400-e29b-41d4-a716-446655440002',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    job = response.json()
    print(f"Job: {job['job_type']} ({job['status']})")
    
    if job['status'] == 'COMPLETED' and job['results']:
        results = job['results']
        print(f"Quality Score: {results['quality_score']:.1f}%")
        print(f"Total Rows: {results['total_rows']:,}")
        print(f"Null %: {results['null_percentage']:.1f}%")
        print(f"Duplicate %: {results['duplicate_percentage']:.1f}%")
        
        if 'pii_fields' in results:
            print(f"PII Fields: {', '.join(results['pii_fields'])}")
        
        if 'data_issues' in results:
            print("\\nData Issues:")
            for issue in results['data_issues']:
                print(f"- {issue}")
                
        if 'recommendations' in results:
            print("\\nRecommendations:")
            for rec in results['recommendations']:
                print(f"- {rec}")
else:
    print(f"Error: {response.text}")`,
            javascript: `fetch('https://api.schlepengine.com/v1/data-processing/processing/jobs/550e8400-e29b-41d4-a716-446655440002', {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(job => {
  console.log(\`Job: \${job.job_type} (\${job.status})\`);
  
  if (job.status === 'COMPLETED' && job.results) {
    const results = job.results;
    console.log(\`Quality Score: \${results.quality_score.toFixed(1)}%\`);
    console.log(\`Total Rows: \${results.total_rows.toLocaleString()}\`);
    console.log(\`Null %: \${results.null_percentage.toFixed(1)}%\`);
    console.log(\`Duplicate %: \${results.duplicate_percentage.toFixed(1)}%\`);
    
    if (results.pii_fields) {
      console.log(\`PII Fields: \${results.pii_fields.join(', ')}\`);
    }
    
    if (results.data_issues) {
      console.log('\\nData Issues:');
      results.data_issues.forEach(issue => console.log(\`- \${issue}\`));
    }
    
    if (results.recommendations) {
      console.log('\\nRecommendations:');
      results.recommendations.forEach(rec => console.log(\`- \${rec}\`));
    }
  }
})
.catch(error => console.error('Error:', error));`
          }}
        />
      </div>
    </div>
  )
}