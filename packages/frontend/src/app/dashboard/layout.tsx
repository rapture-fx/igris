import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
// import { Toaster } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      {/* <Toaster position="top-right" richColors /> */}
    </div>
  )
} 