
export default function LatestUpdate() {
  return (
    <section className="py-20 bg-[#111111]">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <h2 className="text-3xl md:text-4xl font-semibold text-beige-secondary text-left mb-12">
          Latest Updates
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Placeholder for update cards */}
          <div className="bg-[#161616] border border-[#161616] rounded-xl p-6">
            <h3 className="font-semibold text-beige-secondary mb-2">Update Title 1</h3>
            <p className="text-gray-400 text-sm">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <p className="text-gray-500 text-xs mt-4">August 1, 2025</p>
          </div>
          <div className="bg-[#161616] border border-[#161616] rounded-xl p-6">
            <h3 className="font-semibold text-beige-secondary mb-2">Update Title 2</h3>
            <p className="text-gray-400 text-sm">
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p className="text-gray-500 text-xs mt-4">July 25, 2025</p>
          </div>
          <div className="bg-[#161616] border border-[#161616] rounded-xl p-6">
            <h3 className="font-semibold text-beige-secondary mb-2">Update Title 3</h3>
            <p className="text-gray-400 text-sm">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
            <p className="text-gray-500 text-xs mt-4">July 18, 2025</p>
          </div>
        </div>
      </div>
    </section>
  )
}
