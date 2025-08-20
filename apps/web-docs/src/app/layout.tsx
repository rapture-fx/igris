import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/ui/Sidebar'
import { Header } from '@/components/ui/Header'
import { ThemeProvider } from '@/hooks/useTheme'
import { SearchComponent } from '@/components/ui/SearchComponent'

export const metadata: Metadata = {
  title: 'Schlep-engine API Documentation',
  description: 'Comprehensive API documentation for Schlep-engine - AI-powered data preparation platform',
  keywords: ['API', 'documentation', 'data preparation', 'AI', 'machine learning', 'data processing'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-white transition-colors duration-300">
        <ThemeProvider>
          <div className="min-h-screen bg-white">
            <div className="w-full flex">
              <div className="w-64 h-screen sticky top-0 z-40">
                <Sidebar />
              </div>
              <div className="flex-1">
                <div className="sticky top-0 z-50">
                  <Header />
                </div>
                <main className="flex-1 overflow-y-auto bg-white transition-colors duration-300">
                  <div className="pt-8 pb-6 pr-6 w-full flex flex-col items-start -ml-0">
                    {children}
                  </div>
                </main>
              </div>
            </div>
            {/* Global search component - rendered at root level */}
            <div className="fixed inset-0 pointer-events-none z-[10000]">
              <SearchComponent />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}