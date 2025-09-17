export default function CallToAction() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-medium mb-4 leading-tight font-inter" style={{ color: '#1f53d0' }}>Secure at every layer. Built to scale.</h2>
          <p className="text-base mb-8 opacity-90 max-w-2xl mx-auto text-gray-700 dark:text-gray-300">
            Start building powerful ML pipelines and simplify your data handling today.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
            style={{ backgroundColor: '#1f53d0' }}
          >
            Launch Your Pipeline
          </a>
        </div>
      </div>
    </div>
  )
}