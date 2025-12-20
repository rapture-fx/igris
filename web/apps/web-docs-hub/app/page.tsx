'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [overtureDocsUrl, setOvertureDocsUrl] = useState('/overture/docs');
  const [runtimeDocsUrl, setRuntimeDocsUrl] = useState('/runtime/docs');

  useEffect(() => {
    // Use localhost URLs in development, relative paths in production
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setOvertureDocsUrl('http://localhost:3002/overture/docs');
      setRuntimeDocsUrl('http://localhost:3004/runtime/docs');
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="w-full pl-6 sm:pl-8 lg:pl-12">
        {/* Two Column Layout - Entire Page */}
        <div className="grid min-h-screen gap-12" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Left Column - Header, Content, Footer */}
          <div className="flex flex-col justify-between min-h-screen py-2 pr-6">
            {/* Header */}
            <header className="font-inter pt-3 sm:pt-4 lg:pt-6">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <Link href="/" className="flex items-center">
                    <img
                      src="/img/igris-logo-34.png"
                      alt="Igris Inertial"
                      width={20}
                      height={20}
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
            </header>

            {/* Centered Content Section */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-sm space-y-12">
                {/* Title and Description */}
                <div>
                  <h2 className="text-base md:text-lg font-normal mb-4 font-inter" style={{ color: '#000000' }}>
                    Documentation
                  </h2>
                  <p className="text-sm text-gray-600 font-inter">
                    Choose your product to get started with comprehensive guides.
                  </p>
                </div>

                {/* Product Cards */}
                <div className="space-y-4">
                  {/* Overture Card */}
                  <a
                    href={overtureDocsUrl}
                    className="group block w-full max-w-sm rounded-xl p-3 border border-gray-300/60 shadow-sm hover:shadow-sm transition-all duration-300"
                    style={{ backgroundColor: '#f6f6f4' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-1 font-inter">
                          Overture
                        </h3>
                        <p className="text-xs text-gray-600 font-inter">
                          Control Plane
                        </p>
                      </div>
                      <div className="flex items-center text-gray-900 font-inter text-xs group-hover:translate-x-1 transition-transform">
                        Learn more
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </div>
                    </div>
                  </a>

                  {/* Runtime Card */}
                  <a
                    href={runtimeDocsUrl}
                    className="group block w-full max-w-sm rounded-xl p-3 border border-gray-300/60 shadow-sm hover:shadow-sm transition-all duration-300"
                    style={{ backgroundColor: '#f6f6f4' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-1 font-inter">
                          Runtime
                        </h3>
                        <p className="text-xs text-gray-600 font-inter">
                          Execution Plane
                        </p>
                      </div>
                      <div className="flex items-center text-gray-900 font-inter text-xs group-hover:translate-x-1 transition-transform">
                        Learn more
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="text-gray-900 font-inter pb-3 sm:pb-4 lg:pb-6">
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
                  <span className="text-sm text-gray-500 font-inter">
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
            </footer>
          </div>

          {/* Right Column - Placeholder Box */}
          <div className="w-full h-full min-h-screen rounded-xl border border-gray-300/60 shadow-sm overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
            <img 
              src="/img/rightcolumnfill.png" 
              alt="Right column fill" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
