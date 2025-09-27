
export default function LatestUpdate() {
  return (
    <section className="py-20 bg-white dark:bg-black">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white text-left mb-12">
          Latest Updates
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Placeholder for update cards */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Update Title 1</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-4">August 1, 2025</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Update Title 2</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-4">July 25, 2025</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Update Title 3</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-4">July 18, 2025</p>
          </div>
        </div>
      </div>
    </section>
  )
}
