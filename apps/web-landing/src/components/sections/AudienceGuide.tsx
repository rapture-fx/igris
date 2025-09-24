'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Code, MousePointerClick } from 'lucide-react'

export default function AudienceGuide() {
  return (
    <section className="py-16 md:py-24 bg-[#111111] text-beige-secondary">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold text-beige-secondary mb-6 text-left"
        >
          Who are you building for?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xl text-beige-secondary mb-10 text-left"
        >
          Schlep-engine empowers both technical and non-technical users to transform data effortlessly.
          Choose your path below:
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-center gap-6"
        >
          <Link
            href="#developer"
            className="flex-1 bg-[#468BE6] text-beige-secondary px-8 py-4 rounded-lg shadow-lg hover:bg-[#3a7bd5] transition-colors font-semibold text-lg flex items-center justify-center space-x-3"
          >
            <Code className="w-6 h-6" />
            <span>I'm a Developer</span>
          </Link>
          <Link
            href="#nocode"
            className="flex-1 border border-[#468BE6] text-[#468BE6] px-8 py-4 rounded-lg shadow-lg hover:bg-[#468BE6] hover:text-beige-secondary transition-colors font-semibold text-lg flex items-center justify-center space-x-3"
          >
            <MousePointerClick className="w-6 h-6" />
            <span>I'm a Business User</span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
