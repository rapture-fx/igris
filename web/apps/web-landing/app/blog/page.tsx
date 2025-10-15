import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'

export default function BlogPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main style={{ backgroundColor: '#f6f6f4' }}>
        {/* Blog content will go here */}
      </main>
      <Footer />
    </div>
  )
}
