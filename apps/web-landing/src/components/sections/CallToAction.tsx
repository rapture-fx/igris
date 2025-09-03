import Link from 'next/link'

export default function CallToAction() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto">
        <div 
          className="relative py-16 px-8 sm:px-12 lg:px-16 rounded-2xl text-white overflow-hidden"
          style={{
            backgroundImage: `url('/Gradient-Schlep-engine.svg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Subtle noise overlay */}
          <div 
            className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          
          <div className="relative z-10 text-left">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Accelerate your machine learning workflows.</h2>
            <p className="text-base mb-8 opacity-90 max-w-2xl">
              Start building powerful ML pipelines and simplify your data handling today.
            </p>
            <a
              href="/dashboard"
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg dark:bg-[#fcfcf7] dark:text-black inline-block"
            >
              Get Started for Free
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
