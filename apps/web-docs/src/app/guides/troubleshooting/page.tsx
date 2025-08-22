export default function TroubleshootingPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Troubleshooting</h1>
        <p className="text-xl text-gray-600">
          Common issues, solutions, and debugging strategies for Schlep Engine data processing and ML pipelines.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Data Processing Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-red-800">❌ File Upload Failures</h3>
            <div className="mb-4">
              <h4 className="font-medium text-sm mb-2">Symptoms:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Files fail to upload or timeout</li>
                <li>• "Invalid file format" errors</li>
                <li>• Upload progress stalls at certain percentages</li>
              </ul>
            </div>
            <div className="mb-4">
              <h4 className="font-medium text-sm mb-2">Common Causes & Solutions:</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>File size limits:</strong> Break large files into smaller chunks or use streaming upload</li>
                <li>• <strong>Unsupported formats:</strong> Check supported file types (CSV, JSON, Excel, PDF, etc.)</li>
                <li>• <strong>Network timeouts:</strong> Check internet connection and try uploading during off-peak hours</li>
                <li>• <strong>Corrupted files:</strong> Verify file integrity and re-export from source system</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-yellow-800">⚠️ Data Quality Issues</h3>
            <div className="mb-4">
              <h4 className="font-medium text-sm mb-2">Symptoms:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• High percentage of missing or null values</li>
                <li>• Inconsistent data types across columns</li>
                <li>• Unexpected data distributions or outliers</li>
              </ul>
            </div>
            <div className="mb-4">
              <h4 className="font-medium text-sm mb-2">Common Causes & Solutions:</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>Source system issues:</strong> Verify data extraction processes and source data quality</li>
                <li>• <strong>Encoding problems:</strong> Check file encoding (UTF-8, ASCII) and character sets</li>
                <li>• <strong>Schema mismatches:</strong> Use data profiling to understand actual data structure</li>
                <li>• <strong>Incomplete data:</strong> Implement validation rules and data completeness checks</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-blue-800">🔄 Processing Performance Issues</h3>
            <div className="mb-4">
              <h4 className="font-medium text-sm mb-2">Symptoms:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Slow processing times for data transformations</li>
                <li>• Memory errors or out-of-memory exceptions</li>
                <li>• Processing jobs timing out</li>
              </ul>
            </div>
            <div className="mb-4">
              <h4 className="font-medium text-sm mb-2">Common Causes & Solutions:</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>Large datasets:</strong> Use batch processing or data sampling for initial exploration</li>
                <li>• <strong>Complex transformations:</strong> Optimize queries and use efficient data structures</li>
                <li>• <strong>Resource limits:</strong> Increase memory allocation or use distributed processing</li>
                <li>• <strong>Inefficient operations:</strong> Profile code and optimize bottleneck operations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">API & Integration Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Authentication & Authorization</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-red-400 pl-4">
                <h4 className="font-medium text-sm text-red-800">401 Unauthorized</h4>
                <p className="text-sm text-gray-600 mb-2">API requests failing with authentication errors</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Verify API key is correct and active</li>
                  <li>• Check if JWT token has expired</li>
                  <li>• Ensure proper Authorization header format</li>
                  <li>• Confirm user account is active and not suspended</li>
                </ul>
              </div>
              
              <div className="border-l-4 border-orange-400 pl-4">
                <h4 className="font-medium text-sm text-orange-800">403 Forbidden</h4>
                <p className="text-sm text-gray-600 mb-2">Access denied to specific resources</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Check user permissions and role assignments</li>
                  <li>• Verify resource access controls</li>
                  <li>• Ensure API key has required scopes</li>
                  <li>• Contact administrator for permission updates</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Rate Limiting & Timeouts</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-yellow-400 pl-4">
                <h4 className="font-medium text-sm text-yellow-800">429 Too Many Requests</h4>
                <p className="text-sm text-gray-600 mb-2">Hitting API rate limits</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Implement exponential backoff retry logic</li>
                  <li>• Check rate limit headers in responses</li>
                  <li>• Consider upgrading to higher rate limit tier</li>
                  <li>• Optimize API usage patterns</li>
                </ul>
              </div>
              
              <div className="border-l-4 border-purple-400 pl-4">
                <h4 className="font-medium text-sm text-purple-800">Request Timeouts</h4>
                <p className="text-sm text-gray-600 mb-2">API requests timing out before completion</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Increase client timeout settings</li>
                  <li>• Use asynchronous processing for long operations</li>
                  <li>• Break large requests into smaller chunks</li>
                  <li>• Check network connectivity and latency</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Machine Learning Model Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-indigo-800">🤖 Model Training Problems</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">Poor Model Performance</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Check data quality and feature engineering</li>
                  <li>• Verify train/validation/test split ratios</li>
                  <li>• Examine class imbalance and sampling strategies</li>
                  <li>• Try different algorithms and hyperparameters</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-1">Training Failures</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Increase memory allocation for training jobs</li>
                  <li>• Check for missing or infinite values in features</li>
                  <li>• Validate feature data types and scaling</li>
                  <li>• Review error logs for specific failure reasons</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-1">Overfitting</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Add regularization techniques</li>
                  <li>• Increase training data or use data augmentation</li>
                  <li>• Implement cross-validation</li>
                  <li>• Reduce model complexity</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-green-800">🚀 Model Deployment Issues</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">Prediction Errors</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Verify input data format matches training data</li>
                  <li>• Check for data preprocessing consistency</li>
                  <li>• Validate feature scaling and encoding</li>
                  <li>• Monitor for data drift in production</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-1">Slow Inference</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Optimize model size and complexity</li>
                  <li>• Use model quantization techniques</li>
                  <li>• Implement caching for frequent predictions</li>
                  <li>• Consider batch prediction for multiple requests</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">System & Infrastructure Issues</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Resource Management</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">High Memory Usage</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Monitor memory consumption patterns</li>
                  <li>• Use data streaming instead of loading all data</li>
                  <li>• Implement garbage collection optimization</li>
                  <li>• Scale horizontally or increase memory limits</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-1">CPU Bottlenecks</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Profile code to identify bottlenecks</li>
                  <li>• Use parallel processing where applicable</li>
                  <li>• Optimize database queries and indexing</li>
                  <li>• Consider distributed computing solutions</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Network & Connectivity</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">Connection Timeouts</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Check network connectivity and DNS resolution</li>
                  <li>• Verify firewall and security group settings</li>
                  <li>• Implement retry logic with exponential backoff</li>
                  <li>• Monitor network latency and bandwidth</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-1">SSL/TLS Issues</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Verify SSL certificate validity</li>
                  <li>• Check TLS version compatibility</li>
                  <li>• Update root certificate authorities</li>
                  <li>• Configure proper cipher suites</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Debugging Strategies</h2>
        
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Step-by-Step Debugging Process</h3>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h4 className="font-medium text-sm">Identify the Problem</h4>
                <p className="text-xs text-gray-600">Gather error messages, logs, and reproduce the issue consistently</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h4 className="font-medium text-sm">Check System Status</h4>
                <p className="text-xs text-gray-600">Verify system health, resource usage, and service availability</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h4 className="font-medium text-sm">Review Recent Changes</h4>
                <p className="text-xs text-gray-600">Check for recent deployments, configuration changes, or data updates</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">4</div>
              <div>
                <h4 className="font-medium text-sm">Isolate the Issue</h4>
                <p className="text-xs text-gray-600">Use minimal test cases and divide-and-conquer approach</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">5</div>
              <div>
                <h4 className="font-medium text-sm">Apply Solutions</h4>
                <p className="text-xs text-gray-600">Implement fixes incrementally and verify resolution</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Getting Help</h2>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Before Contacting Support</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Check this troubleshooting guide and documentation</li>
              <li>• Gather relevant error messages, logs, and system information</li>
              <li>• Document steps to reproduce the issue</li>
              <li>• Try basic troubleshooting steps (restart, clear cache, etc.)</li>
            </ul>
          </div>

          <div className="bg-green-50 border-l-4 border-green-400 p-6">
            <h3 className="font-semibold mb-3">Support Information to Provide</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Investigation ID or file names involved</li>
              <li>• Timestamp when the issue occurred</li>
              <li>• Browser/client version and operating system</li>
              <li>• Complete error messages and stack traces</li>
              <li>• Screenshots or screen recordings if applicable</li>
            </ul>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
            <h3 className="font-semibold mb-3">Emergency Issues</h3>
            <p className="text-gray-700 mb-3">
              For critical production issues affecting business operations:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Use the emergency support channel</li>
              <li>• Provide immediate business impact assessment</li>
              <li>• Include contact information for follow-up</li>
              <li>• Implement temporary workarounds if available</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}