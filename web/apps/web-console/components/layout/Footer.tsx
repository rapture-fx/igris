'use client';

import { useState } from 'react';
import { BookOpen, ExternalLink, Mail, FileText, Activity, HelpCircle } from 'lucide-react';

export function Footer() {
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';
  const [showHelp, setShowHelp] = useState(false);

  return (
    <footer className="fixed bottom-0 left-0 md:left-64 right-0 z-40 h-8 bg-card md:pl-2 md:pr-2">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-end">

        {/* Right — legal links + help button */}
        <div className="flex items-center gap-5 text-xs text-muted-foreground">
          <a href={`${landingUrl}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Terms of Service
          </a>
          <a href={`${landingUrl}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          <a href={`${landingUrl}/cookies`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Cookie Policy
          </a>
          <span className="text-muted-foreground/70">© 2025 Igris Inertial</span>
        </div>

        {/* Help button */}
        <div className="relative ml-4">
          {showHelp && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowHelp(false)} />
              <div className="absolute bottom-full right-0 mb-2 w-52 z-40 bg-white dark:bg-[#1b1912] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg shadow-md p-2">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5 px-2">Help</p>
                <a
                  href="https://docs.igrisinertial.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                  onClick={() => setShowHelp(false)}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs text-gray-900 dark:text-[#f6f6f4]">Igris Docs</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-gray-400" strokeWidth={1.5} />
                </a>
                <div className="border-t border-gray-100 dark:border-[#f6f6f4]/10 my-1" />
                <a
                  href="mailto:support@igrisinertial.com"
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                  onClick={() => setShowHelp(false)}
                >
                  <Mail className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                  <span className="text-xs text-gray-900 dark:text-[#f6f6f4]">Contact Support</span>
                </a>
                <a
                  href="https://changelog.igrisinertial.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                  onClick={() => setShowHelp(false)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs text-gray-900 dark:text-[#f6f6f4]">Change Log</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-gray-400" strokeWidth={1.5} />
                </a>
                <a
                  href="https://status.igrisinertial.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                  onClick={() => setShowHelp(false)}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs text-gray-900 dark:text-[#f6f6f4]">System Status</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-gray-400" strokeWidth={1.5} />
                </a>
              </div>
            </>
          )}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-gray-100 dark:hover:bg-[#2c2a22] transition-colors"
            title="Help"
          >
            <HelpCircle className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </footer>
  );
}
