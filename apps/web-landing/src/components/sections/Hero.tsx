'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Hero() {
  return (
    <div className="relative min-h-screen overflow-hidden dark:bg-gray-900 pt-32 pb-16" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center pt-40 font-ibm-plex-mono">
          <h1 style={{ color: '#1f53d0' }} className="text-2xl md:text-3xl font-medium text-gray-900 dark:text-white mb-8 leading-tight font-inter">
            Messy Data to ML-ready in API Calls.
          </h1>
          <p className="text-sm md:text-base text-gray-500 mb-12 max-w-3xl mx-auto leading-relaxed font-sf-mono">The data prep API for speed: convert messy inputs into clean, ML-ready outputs, at scale.</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              style={{ backgroundColor: '#1f53d0' }}
              className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
            >
              Get Started <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="http://localhost:3004"
              className="inline-flex items-center justify-center text-gray-700 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg bg-white dark:text-gray-300 dark:hover:bg-gray-800 font-sf-mono border border-gray-200 dark:border-gray-700"
            >
              API Console
            </Link>
          </div>

          <div className="mt-16 max-w-4xl mx-auto relative">
            {/* Crop marks */}
            <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-gray-400"></div>
            <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-gray-400"></div>
            <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-gray-400"></div>
            <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-gray-400"></div>

            <div className="bg-white p-6 text-left shadow-lg" style={{ border: '1px solid #114dcd', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-800">AI Training Data Pipeline: Raw Data → ML-Ready Dataset</h3>
                <span className="text-xs text-gray-500 font-mono">Python</span>
              </div>
              <pre className="text-xs overflow-x-auto font-mono leading-relaxed text-gray-800">
                <code>
                  <span style={{ color: '#114dcd' }}>import</span> requests
                  <br/><br/>
                  <span style={{ color: '#6b7280' }}># 1. Extract structured data from PDFs (Real working endpoint)</span><br/>
                  files = {'{'}'file': <span style={{ color: '#114dcd' }}>open</span>('financial_report.pdf', 'rb'){'}'}<br/>
                  headers = {'{'}'Authorization': 'Bearer YOUR_API_KEY'{'}'}<br/><br/>

                  pdf_response = requests.<span style={{ color: '#114dcd' }}>post</span>(<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;'https://api.schlep-engine.com/api/v1/extract/pdf',<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;headers=headers,<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;files=files<br/>
                  )<br/><br/>

                  extracted_data = pdf_response.<span style={{ color: '#114dcd' }}>json</span>()<br/>
                  <span style={{ color: '#6b7280' }}># → Tables, text, metadata extracted from PDF</span><br/><br/>

                  <span style={{ color: '#6b7280' }}># 2. Train ML model with extracted data (Scikit-learn backend)</span><br/>
                  training_data = {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;"features": extracted_data["tables"][0]["data"],<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;"target_column": "revenue_category",<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;"algorithm": "random_forest",<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;"test_size": 0.2<br/>
                  {'}'}<br/><br/>

                  ml_response = requests.<span style={{ color: '#114dcd' }}>post</span>(<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline',<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;headers=headers,<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;json=training_data<br/>
                  )<br/><br/>

                  result = ml_response.<span style={{ color: '#114dcd' }}>json</span>()<br/>
                  <span style={{ color: '#114dcd' }}>print</span>(f"Model Accuracy: {'{result[\'accuracy\']:.2f}'}")<br/>
                  <span style={{ color: '#114dcd' }}>print</span>(f"Model ID: {'{result[\'model_id\']}'}")
                  <span style={{ color: '#6b7280' }}># → Model Accuracy: 0.89 | Model ID: rf_abc123</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}