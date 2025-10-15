import React from 'react'

export default function StackIntegrations() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-8 mt-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.02) 2px,
            rgba(0,0,0,0.02) 4px
          )`
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container with Original Width */}
          <div className="max-w-[1300px] mx-auto">
            <div className="text-center pt-8 pb-8">
              <p className="text-sm mb-8 font-inter" style={{ color: 'black' }}>Plug into your stack instantly.</p>
              <div className="flex justify-center items-center gap-4 flex-wrap">
                {/* Storage Providers */}
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">AWS S3</span>
                </div>
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">Google Cloud</span>
                </div>
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">Azure Blob</span>
                </div>
                {/* Databases */}
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">PostgreSQL</span>
                </div>
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">MySQL</span>
                </div>
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">MongoDB</span>
                </div>
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">Snowflake</span>
                </div>
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">Elasticsearch</span>
                </div>
                {/* Additional integrations */}
                <div
                  className="w-44 h-28 rounded flex items-center justify-center border border-gray-200"
                  style={{ backgroundColor: '#f2f1ed' }}
                >
                  <span className="text-sm font-bold text-gray-700 text-center">Redis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}