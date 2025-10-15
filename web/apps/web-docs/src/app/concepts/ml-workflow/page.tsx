import { CpuChipIcon, BeakerIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'

export default function MLWorkflowPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ML Workflow</h1>
        <p className="text-xl text-gray-600">
          Learn how Schlep Engine streamlines the entire machine learning workflow from data preparation to model deployment.
        </p>
      </div>

      {/* Workflow Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">End-to-End ML Workflow</h2>
        
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BeakerIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Data Preparation</h3>
              <p className="text-gray-600 text-sm">
                Automated data cleaning, feature engineering, and ML-ready dataset creation in minutes.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CpuChipIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Model Development</h3>
              <p className="text-gray-600 text-sm">
                AutoML pipeline creation, training, and hyperparameter optimization with minimal code.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <RocketLaunchIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Deployment & Monitoring</h3>
              <p className="text-gray-600 text-sm">
                One-click model deployment with real-time monitoring and automated retraining capabilities.
              </p>
            </div>
          </div>
        </div>

        <p className="text-gray-600 leading-relaxed">
          Traditional ML workflows can take weeks or months to go from raw data to production models. 
          Schlep Engine compresses this timeline to hours or days by automating the most time-consuming 
          and error-prone aspects of the ML lifecycle.
        </p>
      </section>

      {/* Phase 1: Data Preparation */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 1: Intelligent Data Preparation</h2>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">From Messy to ML-Ready</h3>
          <p className="text-gray-700">
            Our AI-powered data preparation phase handles the complexity of real-world data, ensuring 
            your models train on high-quality, consistent datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="space-y-4">
            <h4 className="font-semibold">Automatic Data Processing:</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center mt-0.5 font-bold">1</div>
                <div>
                  <p className="font-medium text-sm">Investigation Creation</p>
                  <p className="text-xs text-gray-600">Organize related datasets and processing tasks</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center mt-0.5 font-bold">2</div>
                <div>
                  <p className="font-medium text-sm">Smart Data Profiling</p>
                  <p className="text-xs text-gray-600">AI analysis of data quality, types, and relationships</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center mt-0.5 font-bold">3</div>
                <div>
                  <p className="font-medium text-sm">Automated Cleaning</p>
                  <p className="text-xs text-gray-600">Context-aware cleaning and standardization</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center mt-0.5 font-bold">4</div>
                <div>
                  <p className="font-medium text-sm">Feature Engineering</p>
                  <p className="text-xs text-gray-600">ML-optimized feature creation and selection</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3">Data Quality Assurance</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Completeness</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full w-[92%]"></div>
                  </div>
                  <span className="text-xs text-gray-600">92%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Validity</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full w-[96%]"></div>
                  </div>
                  <span className="text-xs text-gray-600">96%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Consistency</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full w-[88%]"></div>
                  </div>
                  <span className="text-xs text-gray-600">88%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Uniqueness</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full w-[94%]"></div>
                  </div>
                  <span className="text-xs text-gray-600">94%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-medium">Overall Quality Score</span>
                <span className="text-lg font-bold text-green-600">92.5%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <p className="text-sm text-green-700">
            <strong>Time Savings:</strong> What typically takes data scientists 60-80% of their time 
            is completed automatically in minutes, letting you focus on model development and insights.
          </p>
        </div>
      </section>

      {/* Phase 2: AutoML Pipeline */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 2: AutoML Pipeline Development</h2>
        
        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Automated Model Development</h3>
          <p className="text-gray-700">
            Our AutoML engine automatically selects the best algorithms, optimizes hyperparameters, 
            and creates production-ready models tailored to your specific use case.
          </p>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold mb-3 text-green-600">Algorithm Selection</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Classification: Random Forest, XGBoost, SVM</li>
                <li>• Regression: Linear, Ensemble, Neural Networks</li>
                <li>• Clustering: K-Means, DBSCAN, Hierarchical</li>
                <li>• Time Series: ARIMA, Prophet, LSTM</li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold mb-3 text-green-600">Hyperparameter Optimization</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Bayesian optimization</li>
                <li>• Grid and random search</li>
                <li>• Early stopping strategies</li>
                <li>• Cross-validation tuning</li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold mb-3 text-green-600">Model Validation</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• K-fold cross-validation</li>
                <li>• Hold-out test sets</li>
                <li>• Performance metrics</li>
                <li>• Bias and fairness checks</li>
              </ul>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-4">Model Performance Comparison</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Algorithm</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precision</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recall</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F1-Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">XGBoost</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.934</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.912</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.945</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.928</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Best Model
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Random Forest</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.921</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.898</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.936</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.917</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Runner-up
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Logistic Regression</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.887</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.865</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.901</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.883</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Baseline
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 3: Deployment & Monitoring */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 3: Deployment & Monitoring</h2>
        
        <div className="bg-purple-50 border-l-4 border-purple-400 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Production-Ready Deployment</h3>
          <p className="text-gray-700">
            Deploy your models with enterprise-grade infrastructure including auto-scaling, 
            monitoring, and automated retraining capabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <h4 className="font-semibold">Deployment Options:</h4>
            
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium mb-2">🚀 Real-time API</h5>
                <p className="text-sm text-gray-600 mb-2">Low-latency REST endpoints for real-time predictions</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Sub-100ms response times</li>
                  <li>• Auto-scaling based on demand</li>
                  <li>• Built-in authentication</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium mb-2">📊 Batch Processing</h5>
                <p className="text-sm text-gray-600 mb-2">Scheduled batch predictions for large datasets</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Scalable distributed processing</li>
                  <li>• Configurable schedules</li>
                  <li>• Result export to multiple formats</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium mb-2">🔄 Streaming</h5>
                <p className="text-sm text-gray-600 mb-2">Process streaming data in real-time</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Kafka and WebSocket support</li>
                  <li>• Stream processing rules</li>
                  <li>• Real-time alerts</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="font-semibold">Monitoring & Maintenance:</h4>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h5 className="font-medium mb-4">Model Performance Metrics</h5>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Prediction Accuracy</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full w-[93%]"></div>
                    </div>
                    <span className="text-xs text-gray-600">93.4%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Response Time</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full w-[85%]"></div>
                    </div>
                    <span className="text-xs text-gray-600">45ms avg</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Throughput</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full w-[78%]"></div>
                    </div>
                    <span className="text-xs text-gray-600">1.2K/sec</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Error Rate</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full w-[97%]"></div>
                    </div>
                    <span className="text-xs text-gray-600">0.02%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
              <h5 className="font-medium mb-2 text-amber-800">🔄 Automated Retraining</h5>
              <p className="text-sm text-amber-700">
                Models automatically retrain when performance drops or new data patterns emerge, 
                ensuring consistent accuracy over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Examples */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Platform Integrations</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
            <div className="bg-blue-100 rounded-lg p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-lg">Py</span>
            </div>
            <p className="font-medium text-sm">Python SDK</p>
            <p className="text-xs text-gray-600">Native integration</p>
          </div>
          
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
            <div className="bg-orange-100 rounded-lg p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <span className="text-orange-600 font-bold text-lg">📓</span>
            </div>
            <p className="font-medium text-sm">Jupyter</p>
            <p className="text-xs text-gray-600">Notebook integration</p>
          </div>
          
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
            <div className="bg-green-100 rounded-lg p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <span className="text-green-600 font-bold text-lg">☁️</span>
            </div>
            <p className="font-medium text-sm">AWS SageMaker</p>
            <p className="text-xs text-gray-600">Cloud ML platform</p>
          </div>
          
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
            <div className="bg-purple-100 rounded-lg p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">⚡</span>
            </div>
            <p className="font-medium text-sm">Databricks</p>
            <p className="text-xs text-gray-600">Analytics platform</p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <p className="text-sm text-blue-700">
            <strong>Seamless Integration:</strong> Export your trained models and processing pipelines 
            to your preferred ML platform with full compatibility and documentation.
          </p>
        </div>
      </section>

      {/* Workflow Benefits */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Workflow Benefits</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3 text-blue-600">⏱️ 10x Faster Development</h4>
            <p className="text-sm text-gray-600 mb-3">
              Reduce time from raw data to production model from weeks to hours.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Automated data preparation</li>
              <li>• One-click model training</li>
              <li>• Instant deployment options</li>
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3 text-green-600">🎯 Higher Model Accuracy</h4>
            <p className="text-sm text-gray-600 mb-3">
              AI-optimized feature engineering and model selection improve performance.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Intelligent feature creation</li>
              <li>• Automated hyperparameter tuning</li>
              <li>• Best practice implementations</li>
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-3 text-purple-600">🔒 Enterprise Ready</h4>
            <p className="text-sm text-gray-600 mb-3">
              Built-in security, compliance, and monitoring for production deployments.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• SOC2 and GDPR compliance</li>
              <li>• Enterprise authentication</li>
              <li>• 24/7 monitoring and alerts</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}