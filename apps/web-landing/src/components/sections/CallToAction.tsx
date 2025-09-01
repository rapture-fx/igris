import Link from 'next/link'

export default function CallToAction() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white text-center">
      <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Data?</h2>
      <p className="text-xl mb-8">
        Start building powerful ML pipelines and simplify your data handling today.
      </p>
      <Link
        href="/dashboard"
        className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors duration-200 shadow-lg"
      >
        Get Started for Free &rarr;
      </Link>
    </section>
  )
}
