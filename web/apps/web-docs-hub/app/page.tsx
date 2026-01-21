'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [overtureDocsUrl, setOvertureDocsUrl] = useState('/overture/docs');
  const [runtimeDocsUrl, setRuntimeDocsUrl] = useState('/runtime/docs');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setOvertureDocsUrl('http://localhost:3002/overture/docs');
      setRuntimeDocsUrl('http://localhost:3004/runtime/docs');
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col bg-dark-bg">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-50" style={{ backgroundImage: 'url(/hub.png)' }} />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="fixed top-0 left-0 p-6 z-10">
          <Link href="https://igrisinertial.com" className="flex items-center">
            <img
              src="/dmfoot.png"
              alt="Igris Inertial"
              width={25}
              height={25}
              className="h-auto"
            />
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm space-y-12 px-6">
            <div>
              <h2 className="text-base md:text-lg font-normal mb-4 font-inter text-[#f6f6f4] transition-colors duration-200">
                Documentation
              </h2>
              <p className="text-sm text-[#a8a898] font-inter transition-colors duration-200">
                Choose your product to get started with comprehensive guides.
              </p>
            </div>

            <div className="space-y-4">
              <a
                href={overtureDocsUrl}
                className="group block w-full max-w-sm rounded-none p-3 border border-[#f6f6f4]/10 hover:shadow-sm transition-all duration-300 bg-dark-bg/80 backdrop-blur-sm"
                style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[#f6f6f4] mb-1 font-inter transition-colors duration-200">
                      Overture
                    </h3>
                    <p className="text-xs text-[#a8a898] font-inter transition-colors duration-200">
                      Control Plane
                    </p>
                  </div>
                  <div className="flex items-center text-[#f6f6f4] font-inter text-xs group-hover:translate-x-1 transition-transform">
                    Learn more
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </div>
              </a>

              <a
                href={runtimeDocsUrl}
                className="group block w-full max-w-sm rounded-none p-3 border border-[#f6f6f4]/10 hover:shadow-sm transition-all duration-300 bg-dark-bg/80 backdrop-blur-sm"
                style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[#f6f6f4] mb-1 font-inter transition-colors duration-200">
                      Runtime
                    </h3>
                    <p className="text-xs text-[#a8a898] font-inter transition-colors duration-200">
                      Execution Plane
                    </p>
                  </div>
                  <div className="flex items-center text-[#f6f6f4] font-inter text-xs group-hover:translate-x-1 transition-transform">
                    Learn more
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </main>

        <footer className="pb-6 transition-colors duration-200">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 text-center">
              <span className="text-xs text-[#a8a898] font-inter transition-colors duration-200">
                © 2026 Igris Inertial.
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
