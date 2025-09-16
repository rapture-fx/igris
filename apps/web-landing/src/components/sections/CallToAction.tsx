export default function CallToAction() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Your Data-Driven Decisions</h2>
          <p className="text-base mb-8 opacity-90 max-w-2xl mx-auto">
            Start building powerful ML pipelines and simplify your data handling today.
          </p>
          <a
            href="/dashboard"
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-bold text-sm shadow-md hover:shadow-lg dark:bg-white dark:text-black inline-block"
          >
            Get Started for Free
          </a>
        </div>
      </div>
    </div>
  )
}