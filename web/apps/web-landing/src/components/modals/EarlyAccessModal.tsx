'use client';

import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import CustomSelect from '../forms/CustomSelect';

interface EarlyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const planOptions = [
  { value: '', label: 'Select a plan' },
  { value: 'develop', label: 'Develop - $249/month' },
  { value: 'growth', label: 'Growth - $799/month' },
  { value: 'scale', label: 'Scale - $1,899/month' },
];

export default function EarlyAccessModal({ isOpen, onClose }: EarlyAccessModalProps) {
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
  const [validationErrors, setValidationErrors] = useState({
    name: false,
    email: false,
    company: false,
    planInterest: false
  });

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = {
      name: !formData.name.trim(),
      email: !formData.email.trim(),
      company: !formData.company.trim(),
      planInterest: !formData.planInterest,
    };

    setValidationErrors(errors);

    const hasErrors = Object.values(errors).some(Boolean);

    if (hasErrors) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
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

  const handleClose = () => {
    setIsSubmitted(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-60 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 md:p-6">
        <div
          className="relative w-full max-w-[90%] md:max-w-4xl lg:max-w-6xl rounded-xl md:rounded-3xl shadow-2xl overflow-hidden z-[10000]"
          style={{ backgroundColor: '#f6f6f4', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button - Inside modal on mobile, outside on desktop */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 md:top-0 md:right-[-48px] text-gray-700 hover:text-gray-900 transition-colors z-[10001] bg-transparent p-1"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <X className="w-6 h-6 md:w-8 md:h-8" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[300px] md:min-h-[600px] rounded-xl md:rounded-3xl overflow-y-auto" style={{ backgroundColor: '#f6f6f4', maxHeight: '85vh' }}>
            {/* Left Column - Form */}
            <div className={`p-3 md:p-10 lg:p-12 rounded-l-xl md:rounded-l-3xl overflow-y-auto ${isSubmitted ? 'flex items-center justify-center' : ''}`} style={{ backgroundColor: '#f6f6f4' }}>
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="mb-6">
                  </div>
                  <h3 className="text-2xl mb-4 font-inter" style={{ color: '#000000' }}>
                    Thanks for joining early access!
                  </h3>
                  <p className="text-gray-600 mb-6 font-inter max-w-sm mx-auto">
                    We've received your information and will be in touch soon with next steps.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 md:mb-8">
                    <h2 className="text-lg md:text-2xl font-inter mb-1.5 md:mb-3" style={{ color: '#000000' }}>
                      Get Early Access
                    </h2>
                    <p className="text-xs md:text-base text-gray-600 font-inter">
                      Join the waitlist and be among the first to experience Schlep-engine
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-2 md:space-y-5" noValidate>
                  <div>
                    <label htmlFor="name" className="block text-xs md:text-sm mb-1 md:mb-2 font-inter" style={{ color: '#000000' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 md:px-4 md:py-3 rounded-lg border transition-all duration-200 font-inter focus:outline-none text-sm ${validationErrors.name ? 'border-red-500' : ''}`}
                      style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs md:text-sm mb-1 md:mb-2 font-inter" style={{ color: '#000000' }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 md:px-4 md:py-3 rounded-lg border transition-all duration-200 font-inter focus:outline-none text-sm ${validationErrors.email ? 'border-red-500' : ''}`}
                      style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-xs md:text-sm mb-1 md:mb-2 font-inter" style={{ color: '#000000' }}>
                      Company *
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      required
                      value={formData.company}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 md:px-4 md:py-3 rounded-lg border transition-all duration-200 font-inter focus:outline-none text-sm ${validationErrors.company ? 'border-red-500' : ''}`}
                      style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="planInterest" className="block text-xs md:text-sm mb-1 md:mb-2 font-inter" style={{ color: '#000000' }}>
                      Plan Interest *
                    </label>
                  <CustomSelect
                    id="planInterest"
                    name="planInterest"
                    value={formData.planInterest}
                    onChange={handleChange}
                    options={planOptions}
                    className="w-full"
                    style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
                    validationError={validationErrors.planInterest}
                    required
                  />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-xs md:text-sm mb-1 md:mb-2 font-inter" style={{ color: '#000000' }}>
                      Message (Optional)
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={2}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-3 py-2 md:px-4 md:py-3 rounded-lg border transition-all duration-200 font-inter focus:outline-none text-sm"
                      style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
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
                    className="inline-flex items-center justify-center w-full px-3 py-2 md:px-6 md:py-3 text-black rounded-lg transition-all duration-200 font-semibold text-xs md:text-base border border-gray-300 hover:opacity-70 font-inter disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#f6f6f4', minHeight: '40px' }}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Request
                      </>
                    )}
                  </button>
                </form>
              </>
              )}
            </div>

            {/* Right Column - Blank with Placeholder */}
            <div className="hidden md:flex items-center justify-center rounded-r-3xl p-4" style={{ backgroundColor: '#f6f6f4' }}>
              <div
                className="w-[100%] h-[100%] rounded-2xl border border-gray-300 shadow-sm flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: '#f6f6f4', boxShadow: '-5px 0 10px -2px rgba(0, 0, 0, 0.1)' }}
              >
                <img
                  src="/schlep-logo-47.svg"
                  alt="Schlep Engine Diagram"
                  className="w-full h-full object-cover rotate-90 scale-150"
                  style={{ opacity: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
