import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import Link from 'next/link'

export default function PythonSDKPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                Python SDK
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  The official Python SDK for schlep-engine - the fastest way to integrate AI-powered data preparation into your Python applications.
                </p>

                <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Quick Start
                  </h3>
                  <p className="text-green-700">
                    Install with pip and start processing data in under 2 minutes.
                  </p>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Install from PyPI
pip install schlep-engine

# Or with optional dependencies
pip install schlep-engine[pandas,jupyter]`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Example</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import schlep_engine as se
import pandas as pd

# Initialize client
client = se.Client(api_key="your-api-key")

# Load your data
df = pd.read_csv("messy_data.csv")

# Upload and process
result = client.process_dataframe(
    df, 
    operations=["clean", "profile", "auto_label"]
)

# Get cleaned data
clean_df = result.to_dataframe()
print(f"Cleaned {len(clean_df)} rows with {result.quality_score}% quality")`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Core Classes</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Client</h3>
                <p>Main interface to the schlep-engine API:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`client = se.Client(
    api_key="your-api-key",
    base_url="https://api.schlep-engine.com",  # optional
    timeout=30,  # optional
    retry_attempts=3  # optional
)`}</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">ProcessingJob</h3>
                <p>Represents a data processing job:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Start processing
job = client.process_dataframe(df)

# Monitor progress
while job.status != "completed":
    time.sleep(5)
    job.refresh()
    print(f"Progress: {job.progress}%")

# Get results
result = job.get_result()
clean_data = result.to_dataframe()`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Data Processing</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Basic Operations</h3>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Clean data
result = client.clean_data(df)

# Profile data
profile = client.profile_data(df)
print(profile.summary)

# Auto-label columns
labels = client.auto_label(df)
print(labels.column_types)`}</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">Advanced Processing</h3>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Custom processing pipeline
pipeline = se.Pipeline([
    se.operations.RemoveDuplicates(),
    se.operations.StandardizeFormats(),
    se.operations.DetectAnomalies(threshold=0.95),
    se.operations.ImputeMissingValues(strategy="smart")
])

result = client.process_dataframe(df, pipeline=pipeline)

# Batch processing
results = client.process_batch([
    {"data": df1, "name": "dataset1"},
    {"data": df2, "name": "dataset2"}
])`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Working with Files</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Upload file
upload = client.upload_file("data.csv")

# Process uploaded file
result = client.process_upload(upload.id, operations=["clean"])

# Download results
result.download("clean_data.csv")

# Supported formats: CSV, Excel, JSON, Parquet, TSV
upload = client.upload_file("data.xlsx", sheet_name="Sheet1")`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Error Handling</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`try:
    result = client.process_dataframe(df)
except se.APIError as e:
    print(f"API Error: {e.message}")
    print(f"Status Code: {e.status_code}")
except se.RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after} seconds")
except se.ValidationError as e:
    print(f"Data validation failed: {e.details}")
except Exception as e:
    print(f"Unexpected error: {e}")`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Jupyter Integration</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Enable Jupyter widgets
%load_ext schlep_engine.jupyter

# Interactive data profiling
se.profile_widget(df)

# Visual data cleaning
se.clean_widget(df)

# Progress bars and visualizations
result = client.process_dataframe(df, show_progress=True)`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Configuration</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# Environment variables
export SCHLEP_API_KEY=your-api-key
export SCHLEP_BASE_URL=https://api.schlep-engine.com

# Config file (~/.schlep/config.json)
{
  "api_key": "your-api-key",
  "base_url": "https://api.schlep-engine.com",
  "timeout": 30
}

# Load from config
client = se.Client.from_config()`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Requirements</h2>
                
                <ul className="list-disc list-inside space-y-2 mb-8">
                  <li>Python 3.7 or higher</li>
                  <li>requests {'>='} 2.25.0</li>
                  <li>pandas {'>='} 1.3.0 (optional, for DataFrame support)</li>
                  <li>jupyter {'>='} 1.0.0 (optional, for notebook features)</li>
                </ul>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-8">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    Examples & Tutorials
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Check out our comprehensive examples and tutorials for common use cases.
                  </p>
                  <div className="space-y-2">
                    <Link href="/docs/integrations/jupyter" className="block text-blue-600 hover:underline">→ Jupyter Notebook Integration</Link>
                    <Link href="/docs/integrations/aws-sagemaker" className="block text-blue-600 hover:underline">→ AWS SageMaker Integration</Link>
                    <Link href="/docs/api-reference" className="block text-blue-600 hover:underline">→ Complete API Reference</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}