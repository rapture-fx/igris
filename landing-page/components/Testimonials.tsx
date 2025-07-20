'use client'

import { Star, Quote } from 'lucide-react'

export default function Testimonials() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Data Scientist",
      company: "TechCorp",
      avatar: "SC",
      content: "Schlep Engine reduced our data prep time from days to hours. The AI automatically caught issues we would have missed.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez", 
      role: "ML Engineer",
      company: "DataFlow Inc",
      avatar: "MR",
      content: "The API integration was seamless. We plugged it into our existing pipeline and immediately saw a 10x improvement in processing speed.",
      rating: 5
    },
    {
      name: "Emily Watson",
      role: "CTO",
      company: "BioTech Labs", 
      avatar: "EW",
      content: "As a CTO, data quality is crucial for our enterprise. Schlep Engine's security compliance and intelligent profiling made it an easy choice.",
      rating: 5
    }
  ]

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Loved by Data Teams Worldwide
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join thousands of data scientists, ML engineers, and researchers who trust Schlep Engine
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-lg p-8 border border-gray-100"
            >
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-[#1A5799] rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>

              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>

              <div className="relative">
                <Quote className="absolute -top-2 -left-2 w-8 h-8 text-gray-300" />
                <p className="text-gray-700 leading-relaxed pl-6">
                  "{testimonial.content}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}