'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Hero() {
  return React.createElement('div', {
    className: "relative min-h-screen overflow-hidden dark:bg-gray-900 pt-32 pb-16",
    style: { backgroundColor: '#f7f7f3' }
  },
    React.createElement('div', {
      className: "relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
    },
      React.createElement('div', {
        className: "text-center pt-40 font-ibm-plex-mono"
      },
        React.createElement('h1', {
          style: { color: '#1f53d0' },
          className: "text-2xl md:text-3xl font-medium text-gray-900 dark:text-white mb-8 leading-tight font-inter"
        }, "Messy Data to ML-ready in API Calls."),

        React.createElement('p', {
          className: "text-sm md:text-base text-gray-500 mb-12 max-w-3xl mx-auto leading-relaxed font-sf-mono"
        }, "The data prep API for speed: convert messy inputs into clean, ML-ready outputs, at scale."),

        React.createElement('div', {
          className: "flex justify-center gap-4"
        },
          React.createElement(Link, {
            href: "/dashboard",
            style: { backgroundColor: '#1f53d0' },
            className: "inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
          },
            "Get Started ",
            React.createElement(ChevronRight, { className: "w-4 h-4 ml-2" })
          ),
          React.createElement(Link, {
            href: "http://localhost:3004",
            className: "inline-flex items-center justify-center text-gray-700 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg bg-white dark:text-gray-300 dark:hover:bg-gray-800 font-sf-mono border border-gray-200 dark:border-gray-700"
          }, "API Console")
        ),

        React.createElement('div', {
          className: "mt-16 max-w-4xl mx-auto"
        },
          React.createElement('div', {
            className: "flex gap-1 mb-0"
          },
            React.createElement('button', {
              className: "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0",
              id: "python-tab",
              onClick: () => {
                document.getElementById('python-tab').className = "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0";
                document.getElementById('curl-tab').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('line-numbers').innerHTML = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23';
                document.getElementById('code-content').innerHTML = `<code><span style="color: #114dcd;">import</span> requests

<span style="color: #6b7280;"># Upload a PDF, extract data</span>
files = {<span style="color: #4b5563;">'file'</span>: <span style="color: #114dcd;">open</span>(<span style="color: #4b5563;">'financial_report.pdf'</span>, <span style="color: #4b5563;">'rb'</span>)}
res = <span style="color: #114dcd;">requests.post</span>(
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/extract/pdf'</span>,
  headers={<span style="color: #4b5563;">'Authorization'</span>: <span style="color: #4b5563;">'Bearer API_KEY'</span>},
  files=files
)

<span style="color: #6b7280;"># Train a model in one call</span>
train = {
  <span style="color: #4b5563;">"features"</span>: <span style="color: #114dcd;">res.json</span>()[<span style="color: #4b5563;">"tables"</span>][<span style="color: #dc2626;">0</span>][<span style="color: #4b5563;">"data"</span>],
  <span style="color: #4b5563;">"target_column"</span>: <span style="color: #4b5563;">"revenue_category"</span>
}
ml = <span style="color: #114dcd;">requests.post</span>(
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline'</span>,
  headers={<span style="color: #4b5563;">'Authorization'</span>: <span style="color: #4b5563;">'Bearer API_KEY'</span>},
  json=train
)

<span style="color: #114dcd;">print</span>(f<span style="color: #4b5563;">"Accuracy: {ml.json()['accuracy']:.2f}"</span>)

<span style="color: #114dcd;"># → Accuracy: 0.89</span></code>`;
              }
            }, "Python"),
            React.createElement('button', {
              className: "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0",
              id: "curl-tab",
              onClick: () => {
                document.getElementById('curl-tab').className = "px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 border-b-0";
                document.getElementById('python-tab').className = "px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 border-b-0";
                document.getElementById('line-numbers').innerHTML = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17';
                document.getElementById('code-content').innerHTML = `<code><span style="color: #6b7280;"># Upload a PDF, extract data</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST \\
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/extract/pdf'</span> \\
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer API_KEY'</span> \\
  <span style="color: #dc2626;">-F</span> <span style="color: #4b5563;">'file=@financial_report.pdf'</span>

<span style="color: #6b7280;"># Train a model in one call</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST \\
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline'</span> \\
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer API_KEY'</span> \\
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> \\
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{
    "features": [extracted_data],
    "target_column": "revenue_category"
  }'</span>

<span style="color: #114dcd;"># → {"accuracy": 0.89, "model_id": "rf_abc123"}</span></code>`;
              }
            }, "cURL")
          ),

          React.createElement('div', {
            className: "bg-white text-left shadow-lg relative",
            style: {
              border: '1px solid #114dcd',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }
          },
            React.createElement('div', {
              className: "flex items-center justify-between p-4"
            },
              React.createElement('h3', {
                className: "text-sm font-medium text-gray-800"
              }, "From PDF to ML Model in 10 lines")
            ),
            React.createElement('button', {
              className: "absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 transition-colors",
              onClick: () => {
                const pythonCode = 'import requests\n\n# Upload a PDF, extract data\nfiles = {\'file\': open(\'financial_report.pdf\', \'rb\')}\nres = requests.post(\n  \'https://api.schlep-engine.com/api/v1/extract/pdf\',\n  headers={\'Authorization\': \'Bearer API_KEY\'},\n  files=files\n)\n\n# Train a model in one call\ntrain = {\n  "features": res.json()["tables"][0]["data"],\n  "target_column": "revenue_category"\n}\nml = requests.post(\n  \'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline\',\n  headers={\'Authorization\': \'Bearer API_KEY\'},\n  json=train\n)\n\nprint(f"Accuracy: {ml.json()[\'accuracy\']:.2f}")\n# → Accuracy: 0.89';
                navigator.clipboard?.writeText(pythonCode);
              }
            },
              React.createElement('svg', {
                className: "w-4 h-4",
                fill: "none",
                stroke: "currentColor",
                viewBox: "0 0 24 24"
              },
                React.createElement('path', {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                })
              )
            ),

            React.createElement('div', { className: "p-4 flex" },
              React.createElement('div', {
                className: "flex-shrink-0 pr-4 text-right border-r border-gray-200 mr-4",
                style: { color: '#9ca3af' }
              },
                React.createElement('div', {
                  className: "text-xs font-mono leading-relaxed whitespace-pre",
                  id: "line-numbers"
                },
                  '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23'
                )
              ),
              React.createElement('pre', {
                className: "text-xs overflow-x-auto font-mono leading-relaxed text-gray-800 whitespace-pre flex-grow",
                id: "code-content",
                dangerouslySetInnerHTML: { __html: `<code><span style="color: #114dcd;">import</span> requests

<span style="color: #6b7280;"># Upload a PDF, extract data</span>
files = {<span style="color: #4b5563;">'file'</span>: <span style="color: #114dcd;">open</span>(<span style="color: #4b5563;">'financial_report.pdf'</span>, <span style="color: #4b5563;">'rb'</span>)}
res = <span style="color: #114dcd;">requests.post</span>(
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/extract/pdf'</span>,
  headers={<span style="color: #4b5563;">'Authorization'</span>: <span style="color: #4b5563;">'Bearer API_KEY'</span>},
  files=files
)

<span style="color: #6b7280;"># Train a model in one call</span>
train = {
  <span style="color: #4b5563;">"features"</span>: <span style="color: #114dcd;">res.json</span>()[<span style="color: #4b5563;">"tables"</span>][<span style="color: #dc2626;">0</span>][<span style="color: #4b5563;">"data"</span>],
  <span style="color: #4b5563;">"target_column"</span>: <span style="color: #4b5563;">"revenue_category"</span>
}
ml = <span style="color: #114dcd;">requests.post</span>(
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline'</span>,
  headers={<span style="color: #4b5563;">'Authorization'</span>: <span style="color: #4b5563;">'Bearer API_KEY'</span>},
  json=train
)

<span style="color: #114dcd;">print</span>(f<span style="color: #4b5563;">"Accuracy: {ml.json()['accuracy']:.2f}"</span>)

<span style="color: #114dcd;"># → Accuracy: 0.89</span></code>` }
              })
            )
          )
        )
      )
    )
  )
}