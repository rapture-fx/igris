import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/hooks/useTheme'
import { Sidebar } from '@/components/ui/Sidebar'
import { Header } from '@/components/ui/Header'
import { SearchComponent } from '@/components/ui/SearchComponent'

export const metadata: Metadata = {
  title: 'Schlep-engine API Documentation',
  description: 'Comprehensive API documentation for Schlep-engine - AI-powered data preparation platform',
  keywords: ['API', 'documentation', 'data preparation', 'AI', 'machine learning', 'data processing'],
}

function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="w-full flex">
        <div className="w-72 h-screen sticky top-0 z-40">
          <Sidebar />
        </div>
        <div className="flex-1">
          <div className="sticky top-0 z-50">
            <Header />
          </div>
          <main className="flex-1 overflow-y-auto transition-colors duration-300">
            <div className="pt-8 pb-6 pr-6 w-full grid grid-cols-2 gap-6" style={{ paddingLeft: '3rem' }}>
              <div className="flex flex-col items-start">
                {children}
              </div>
              <div className="flex flex-col">
                {/* Right column - empty for future use */}
              </div>
            </div>
          </main>
        </div>
      </div>
      {/* SearchComponent temporarily disabled due to overlay issue */}
      {/* <div className="fixed inset-0 pointer-events-none z-[10000]">
        <SearchComponent />
      </div> */}
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                document.documentElement.classList.add('light');
                document.documentElement.style.backgroundColor = 'white';
                document.body.style.backgroundColor = 'white';
                document.body.style.color = '#111827';
              } catch (e) {}
            })();
          `
        }} />
      </head>
      <body className="antialiased bg-white text-gray-900">
        <ThemeProvider>
          <AppContent>{children}</AppContent>
        </ThemeProvider>
      </body>
    </html>
  )
}
