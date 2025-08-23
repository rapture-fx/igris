import Link from 'next/link'

export default function SolutionsPage() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Column 1: Use Cases */}
          <div className="relative">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Use Cases</h2>
              <div className="space-y-4">
                <Link href="/docs/use-cases/ml-training" className="block p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-gray-900">ML Training</h3>
                  <p className="text-base text-gray-600">Prepare data for machine learning models.</p>
                </Link>
                <Link href="/docs/use-cases/ecommerce" className="block p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-gray-900">E-commerce Analytics</h3>
                  <p className="text-base text-gray-600">Customer insights and inventory optimization.</p>
                </Link>
                <Link href="/docs/use-cases/quality-monitoring" className="block p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-gray-900">Quality Monitoring</h3>
                  <p className="text-base text-gray-600">Monitor and validate data quality.</p>
                </Link>
              </div>
            </div>
          </div>

          {/* Column 2: Industry */}
          <div className="relative">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Industry</h2>
              <div className="space-y-4">
                <Link href="/industries/financial-services" className="block p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Services</h3>
                  <p className="text-base text-gray-600">Empower financial services with clean data.</p>
                </Link>
                <Link href="/industries/ecommerce" className="block p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-gray-900">E-commerce</h3>
                  <p className="text-base text-gray-600">Optimize retail operations and analytics.</p>
                </Link>
                <Link href="/industries/manufacturing" className="block p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-gray-900">Manufacturing</h3>
                  <p className="text-base text-gray-600">Improve manufacturing with sensor data.</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16 text-center">
          <Link href="/sales-collateral" className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-200">
            View case studies & ROI calculator →
          </Link>
        </div>
      </div>
    </div>
  )
}
