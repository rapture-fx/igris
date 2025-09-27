import Image from 'next/image'

export default function CallToAction() {
  return (
    <div className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-left p-4 relative" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Left Column - Content */}
              <div>
                <h2 className="text-2xl md:text-3xl font-medium mb-4 leading-tight font-inter" style={{ color: '#1f53d0' }}>Secure at every layer. Built to scale.</h2>
                <p className="text-base mb-8 opacity-90 text-gray-700 dark:text-gray-300">
                  Build a powerful ML pipelines and simplify your data handling.
                </p>
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#1f53d0' }}
                >
                  Launch Your Pipeline
                </a>
              </div>

              {/* Right Column - SVG */}
              <div className="flex justify-center lg:justify-end">
                <Image
                  src="/CTA.svg"
                  alt="CTA Illustration"
                  width={300}
                  height={300}
                  className="w-full max-w-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}