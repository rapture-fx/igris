import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'
import { CodeBlock } from '@/src/components/docs/CodeBlock'
import Link from 'next/link'

export default function JupyterIntegration() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                Jupyter Notebooks Integration
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  Seamlessly integrate schlep-engine into your Jupyter notebook workflows for interactive data processing and analysis.
                </p>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    Why Jupyter + schlep-engine?
                  </h3>
                  <ul className="text-blue-700 space-y-1">
                    <li>Interactive data exploration and processing</li>
                    <li>Real-time pipeline debugging and visualization</li>
                    <li>Seamless integration with existing data science workflows</li>
                    <li>Support for collaborative notebook environments</li>
                  </ul>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>
                
                <p>Install the schlep-engine Python SDK in your Jupyter environment:</p>
                
                <CodeBlock 
                  language="bash"
                  code={`# Install via pip
pip install schlep-engine

# Or via conda
conda install -c conda-forge schlep-engine`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>
                
                <p>Get started with a simple data processing pipeline:</p>
                
                <CodeBlock 
                  language="python"
                  code={`import schlep_engine as se
import pandas as pd

# Initialize schlep-engine client
client = se.Client(api_key="your-api-key")

# Load sample data
df = pd.read_csv("your-data.csv")

# Create a processing pipeline
pipeline = client.create_pipeline(
    name="jupyter-demo",
    source=df,
    operations=[
        se.operations.clean_nulls(),
        se.operations.normalize_columns(),
        se.operations.detect_anomalies()
    ]
)

# Execute pipeline
result = pipeline.execute()
print(f"Processed {len(result)} rows successfully")`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Interactive Features</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Pipeline Visualization</h3>
                <p>Visualize your data processing pipeline directly in your notebook:</p>
                
                <CodeBlock 
                  language="python"
                  code={`# Visualize pipeline flow
pipeline.visualize()

# Monitor execution progress
with pipeline.monitor() as monitor:
    result = pipeline.execute()
    monitor.show_progress()`}
                />

                <h3 className="text-2xl font-semibold mt-8 mb-4">Real-time Debugging</h3>
                <p>Debug your pipelines with interactive breakpoints and data inspection:</p>
                
                <CodeBlock 
                  language="python"
                  code={`# Add debugging breakpoints
pipeline.add_breakpoint("after_cleaning")

# Inspect intermediate results
intermediate_data = pipeline.get_intermediate_result("after_cleaning")
intermediate_data.head()`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Advanced Examples</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Machine Learning Workflow</h3>
                
                <CodeBlock 
                  language="python"
                  code={`from schlep_engine import ml

# Create ML-ready pipeline
ml_pipeline = client.create_ml_pipeline(
    name="feature-engineering",
    data=df,
    target_column="target",
    operations=[
        se.operations.encode_categorical(),
        se.operations.scale_features(),
        se.operations.generate_features(),
        ml.feature_selection(method="correlation", threshold=0.8)
    ]
)

# Split and prepare data
train_data, test_data = ml_pipeline.train_test_split(test_size=0.2)

# Export for model training
ml_pipeline.export_to_sklearn()`}
                />

                <h3 className="text-2xl font-semibold mt-8 mb-4">Collaborative Workflows</h3>
                
                <CodeBlock 
                  language="python"
                  code={`# Share pipeline with team
pipeline.share(
    users=["colleague@company.com"],
    permissions=["read", "execute"]
)

# Load shared pipeline
shared_pipeline = client.load_pipeline("shared-pipeline-id")

# Collaborate with version control
pipeline.create_branch("experiment-branch")
# Make changes...
pipeline.merge_branch("main")`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Best Practices</h2>
                
                <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-green-800 mb-4">
                    Performance Tips
                  </h3>
                  <ul className="text-green-700 space-y-2">
                    <li><strong>Chunk large datasets:</strong> Use <code>pipeline.set_chunk_size(1000)</code> for memory efficiency</li>
                    <li><strong>Cache intermediate results:</strong> Enable caching with <code>pipeline.enable_cache()</code></li>
                    <li><strong>Parallel processing:</strong> Set <code>n_jobs=-1</code> to use all available cores</li>
                    <li><strong>Monitor memory usage:</strong> Use <code>pipeline.memory_monitor()</code> for large datasets</li>
                  </ul>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Troubleshooting</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Kernel Memory Issues</h3>
                    <p className="text-gray-600 mb-2">
                      If you experience memory issues with large datasets:
                    </p>
                    <CodeBlock 
                      language="python"
                      code={`# Enable streaming processing
pipeline.enable_streaming(chunk_size=1000)

# Or use lazy evaluation
pipeline.set_evaluation_mode("lazy")`}
                    />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">API Connection Issues</h3>
                    <p className="text-gray-600 mb-2">
                      For connection problems in notebook environments:
                    </p>
                    <CodeBlock 
                      language="python"
                      code={`# Check connection status
client.test_connection()

# Configure for notebook environments
client.configure(
    environment="jupyter",
    timeout=300,  # Longer timeout for notebooks
    retry_attempts=3
)`}
                    />
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Widget Integration</h2>
                
                <p>Use interactive widgets for a better notebook experience:</p>
                
                <CodeBlock 
                  language="python"
                  code={`# Enable Jupyter widgets
%load_ext schlep_engine.jupyter

# Interactive data profiling widget
se.profile_widget(df)

# Data cleaning widget with visual feedback
cleaned_df = se.clean_widget(df)

# Progress visualization
result = client.process_dataframe(df, show_progress=True)`}
                />

                <div className="bg-gray-50 p-6 rounded-lg mt-12">
                  <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
                  <ul className="space-y-2">
                    <li><Link href="/docs/sdks/python" className="text-blue-600 hover:underline">→ Python SDK Documentation</Link></li>
                    <li><Link href="/docs/integrations/aws-sagemaker" className="text-blue-600 hover:underline">→ AWS SageMaker Integration</Link></li>
                    <li><Link href="/docs/api-reference" className="text-blue-600 hover:underline">→ Complete API Reference</Link></li>
                  </ul>
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