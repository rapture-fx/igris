'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { PLAN_INTEREST_OPTIONS } from '../../lib/pricing';

export default function EarlyAccessForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    planInterest: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Store submission temporarily in JSON file or send to Supabase
      // For now, we'll simulate a successful submission
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      setIsSubmitted(true);
      setFormData({
        name: '',
        email: '',
        company: '',
        planInterest: '',
        message: ''
      });
    } catch (err) {
      setError('Failed to submit form. Please try again later.');
      console.error('Form submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section id="early-access-form" className="py-16 sm:py-20 lg:py-24 dark:bg-gray-900" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center p-12 rounded-2xl shadow-xl" style={{ backgroundColor: '#ffffff' }}>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#16A34A20' }}>
                <svg className="w-8 h-8" style={{ color: '#16A34A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4 font-inter" style={{ color: '#000000' }}>
              Thanks for joining early access!
            </h3>
            <p className="text-gray-600 mb-6 font-inter">
              We&apos;ve received your information and will be in touch soon with next steps.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="inline-flex items-center px-6 py-3 text-white rounded-lg transition-all duration-200 font-semibold text-base shadow-md hover:shadow-lg"
              style={{ backgroundColor: '#1f53d0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="early-access-form" className="py-16 sm:py-20 lg:py-24 dark:bg-gray-900" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
            Get Early Access
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 font-inter">
            Join the waitlist and be among the first to experience Igris Inertial
          </p>
        </div>

        <div className="rounded-2xl shadow-xl p-8" style={{ backgroundColor: '#ffffff' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold mb-2 font-inter" style={{ color: '#000000' }}>
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-inter"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-2 font-inter" style={{ color: '#000000' }}>
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-inter"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-semibold mb-2 font-inter" style={{ color: '#000000' }}>
                Company *
              </label>
              <input
                type="text"
                id="company"
                name="company"
                required
                value={formData.company}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-inter"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label htmlFor="planInterest" className="block text-sm font-semibold mb-2 font-inter" style={{ color: '#000000' }}>
                Plan Interest *
              </label>
              <select
                id="planInterest"
                name="planInterest"
                required
                value={formData.planInterest}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-inter"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}
              >
                {PLAN_INTEREST_OPTIONS.map((option) => (
                  <option key={option.value || 'empty'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold mb-2 font-inter" style={{ color: '#000000' }}>
                Message (Optional)
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formData.message}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-inter"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}
                placeholder="Tell us about your use case..."
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                <p className="text-sm font-inter" style={{ color: '#DC2626' }}>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center px-6 py-4 text-white rounded-lg transition-all duration-200 font-semibold text-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1f53d0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Request
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
