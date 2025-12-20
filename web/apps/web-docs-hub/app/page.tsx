import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f6f6f4' }}>
      {/* Header - matching landing page */}
      <header className="py-4 font-inter" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <img
                  src="/img/igris-logo-34.png"
                  alt="Igris Inertial"
                  width={30}
                  height={30}
                />
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <Link
                href="https://igrisinertial.com"
                className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 font-inter" style={{ color: '#000000' }}>
            Documentation
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto font-inter">
            Choose your product to get started with comprehensive guides, API references, and examples.
          </p>
        </div>

        {/* Product Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Overture Card */}
          <a
            href="http://localhost:3002/overture/docs"
            className="group block rounded-3xl p-8 border border-gray-300/60 shadow-sm hover:shadow-md transition-all duration-300 hover:border-gray-400/80"
            style={{ backgroundColor: '#f6f6f4' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-medium text-gray-900 mb-1 font-inter">
                  Overture
                </h3>
                <p className="text-xs text-gray-600 font-inter">
                  Control Plane
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed font-inter mb-6">
              Cloud orchestration with intelligent routing, shadow mode testing, and multi-provider consensus.
              Automated cost governance, quality-aware optimization, and multi-tenant isolation for enterprise operations.
            </p>

            <div className="flex items-center text-gray-900 font-inter text-sm group-hover:translate-x-1 transition-transform">
              Learn more
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </a>

          {/* Runtime Card */}
          <a
            href="http://localhost:3004/runtime/docs"
            className="group block rounded-3xl p-8 border border-gray-300/60 shadow-sm hover:shadow-md transition-all duration-300 hover:border-gray-400/80"
            style={{ backgroundColor: '#f6f6f4' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-medium text-gray-900 mb-1 font-inter">
                  Runtime
                </h3>
                <p className="text-xs text-gray-600 font-inter">
                  Execution Plane
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed font-inter mb-6">
              Offline-capable edge runtime with automatic local LLM fallback.
              Pure Rust with streaming, GPU acceleration, peer-to-peer swarm intelligence, and on-device fine-tuning.
              Zero-downtime when cloud fails.
            </p>

            <div className="flex items-center text-gray-900 font-inter text-sm group-hover:translate-x-1 transition-transform">
              Learn more
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </a>
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-600 font-inter">
            Both products share common concepts like observability, multi-tenancy, and OpenAI-compatible APIs.
          </p>
        </div>
      </main>

      {/* Footer - matching landing page */}
      <footer className="text-gray-900 font-inter" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <Link href="/terms" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/cookies" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Cookie Policy
                </Link>
                <p className="text-sm text-gray-500 font-inter">
                  support@igris-inertial.com
                </p>
                <span className="text-gray-500">
                  © 2025 Igris Inertial.
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  <img
                    src="/img/igris-logo-34.png"
                    alt="Igris Inertial"
                    width={20}
                    height={20}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
