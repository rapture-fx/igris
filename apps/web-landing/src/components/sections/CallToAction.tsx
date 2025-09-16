'use client';
import React from 'react'
import Link from 'next/link'

export default function CallToAction() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto">
        <div 
          className="relative py-16 px-8 sm:px-12 lg:px-16 rounded-2xl text-white overflow-hidden"
          style={{
            backgroundImage: `url('/Gradient-Schlep-engine.svg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Subtle noise overlay */}
          <div 
            className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          
          <div className="relative z-10 text-left">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Your Data-Driven Decisions</h2>
            <p className="text-base mb-8 opacity-90 max-w-2xl">
              Start building powerful ML pipelines and simplify your data handling today.
            </p>
            <a
              href="/dashboard"
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-bold text-sm shadow-md hover:shadow-lg dark:bg-[#fcfcf7] dark:text-black inline-block"
            >
              Get Started for Free
            </a>
            <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'white', border: '1px solid #114dcd' }}>
              <pre className="text-sm overflow-x-auto"><code>
import schlep_engine as se

# Initialize Schlep Engine client
client = se.Client(api_key="YOUR_API_KEY")

# Define input data (messy data)
messy_data = {
    "records": [
        {"id": "1", "name": "  John Doe  ", "email": "john.doe@example.com ", "age": "30"},
        {"id": "2", "name": "Jane Smith", "email": "jane.smith@example.com", "age": "twenty-five"},
        {"id": "3", "name": "Peter Jones", "email": "peter.jones@example.com", "age": "45.5"},
    ]
}

# Define data cleaning and preparation pipeline
pipeline = se.Pipeline([
    se.operations.TrimWhitespace(fields=["name", "email"]),
    se.operations.ConvertToType(field="age", target_type="integer", on_error="set_null"),
    se.operations.RemoveDuplicates(field="email"),
    se.operations.NormalizeText(field="name", case="title"),
    se.operations.ValidateSchema(schema={
        "id": {"type": "string"},
        "name": {"type": "string"},
        "email": {"type": "string", "pattern": "^[^@]+@[^@]+\.[^@]+$"},
        "age": {"type": ["integer", "null"]}
    })
])

# Process data
cleaned_data = client.process_data(data=messy_data, pipeline=pipeline)

# Output ML-ready data
print(cleaned_data)
              </code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}