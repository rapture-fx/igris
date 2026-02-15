'use client';

import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-200 w-full">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-4 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Logo width={32} height={32} alt="Igris-engine Logo" />
              <span className="text-lg font-bold text-gray-900 font-apple">Igris-engine</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed max-w-md font-apple">
              The open source data intelligence platform that gives you everything you need to build, deploy, and scale your data applications.
            </p>
          </div>
          
          <div>
            <h3 className="text-gray-900 font-semibold mb-3 text-sm font-apple">Product</h3>
            <ul className="space-y-2">
              <li><Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">Features</Link></li>
              <li><Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">Pricing</Link></li>
              <li><Link href="/docs" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">Documentation</Link></li>
              <li><Link href="/api" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">API</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-gray-900 font-semibold mb-3 text-sm font-apple">Company</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">About</Link></li>
              <li><Link href="/careers" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">Careers</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">Contact</Link></li>
              <li><Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-apple">Privacy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-center w-full">
          <p className="text-gray-600 text-xs font-apple">
            © 2024 Igris-engine. All rights reserved.
          </p>
          <div className="flex items-center space-x-6 mt-3 md:mt-0">
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors text-xs font-apple">Terms</Link>
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors text-xs font-apple">Privacy</Link>
            <Link href="/security" className="text-gray-600 hover:text-gray-900 transition-colors text-xs font-apple">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer; 