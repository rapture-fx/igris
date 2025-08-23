import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'

export default function SolutionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
