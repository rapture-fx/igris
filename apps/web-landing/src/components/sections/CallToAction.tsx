export default function CallToAction() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="max-w-4xl mx-auto">
        <div
          className="bg-white text-left shadow-lg relative z-10 p-8"
          style={{
            border: '1px solid #114dcd',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          }}
        >
          {/* CTA content */}
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-medium mb-4 leading-tight font-inter" style={{ color: '#1f53d0' }}>Your Data-Driven Decisions, Simplified.</h2>
            <p className="text-base mb-8 opacity-90 max-w-2xl mx-auto text-gray-700">
              Start building powerful ML pipelines and simplify your data handling today.
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#1f53d0' }}
            >
              Get Started for Free
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}