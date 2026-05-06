'use client';

import React, { useEffect } from 'react';
import { FLEET_GATING_COPY } from '../../lib/pricing';

interface OverturePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OverturePopup({ isOpen, onClose }: OverturePopupProps) {
  const capabilities = [
    {
      title: 'Zero-Config Fleet Management',
      description: 'Manage all your Runtime devices from a single dashboard. No setup required.',
      how: 'Runtime devices automatically connect and report status when online. View all your devices, their health, model versions, and activity in real-time. No manual configuration needed.',
      features: [
        'Automatic device discovery',
        'Real-time status monitoring',
        'Device health tracking',
        'Model version overview'
      ]
    },
    {
      title: 'QR Code Device Pairing',
      description: 'Add new devices to your fleet in seconds with QR code linking.',
      how: 'Generate a QR code from the dashboard, scan it with your device, and it\'s instantly linked to your fleet. No API keys to copy, no config files to edit. Perfect for field deployment.',
      features: [
        'Instant QR code pairing',
        'No manual configuration',
        'Bulk device onboarding',
        'Field-deployment ready'
      ]
    },
    {
      title: 'Over-the-Air Model Updates',
      description: 'Deploy new models to your entire fleet with a single click.',
      how: 'Upload GGUF models to the dashboard and push them to selected devices or your entire fleet. Runtime devices download and verify updates automatically. Rollback if issues occur.',
      features: [
        'Single-click model deployment',
        'Selective or fleet-wide updates',
        'Automatic verification',
        'Safe rollback capability'
      ]
    },
    {
      title: 'Configuration Sync',
      description: 'Keep device configurations consistent across your fleet.',
      how: 'Define configuration templates in the dashboard and apply them to groups of devices. Runtime syncs configs when online and caches them for offline operation. Changes propagate automatically.',
      features: [
        'Configuration templates',
        'Group-based management',
        'Automatic sync when online',
        'Offline config caching'
      ]
    },
    {
      title: 'Fleet Analytics & Logs',
      description: 'Monitor performance and troubleshoot issues across your entire fleet.',
      how: 'Aggregate logs, metrics, and telemetry from all Runtime devices. View execution stats, error rates, resource usage, and model performance. Export data for external analysis.',
      features: [
        'Centralized log aggregation',
        'Performance metrics',
        'Error tracking',
        'Data export (CSV, JSON)'
      ]
    },
    {
      title: 'Included with Runtime',
      description: 'The dashboard unlocks automatically when you scale. No separate purchase.',
      how: FLEET_GATING_COPY,
      features: [
        'Included with Runtime',
        'No additional cost',
        'Scales with your plan',
        'Unlocks automatically'
      ]
    },
  ];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[800px] bg-[#f6f6f4] dark:bg-dark-bg shadow-xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 relative" style={{ minHeight: '180px' }}>
          <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r section-border" style={{ minHeight: '180px' }}>
            <div className="mx-auto w-full relative z-10" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
              <div className="mb-6 text-left">
                <h1 className="text-sm md:text-base font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', letterSpacing: '0.1em' }}>
                  Fleet View
                </h1>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  The horizon that appears when you scale.
                </h2>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-geist-sans">
                  When you have multiple Runtime devices, this is the command center. Not a separate product. Not an integration. Just the natural evolution of running more than one thing.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="relative z-10">
            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 pt-0 pb-8 flex flex-col bg-transparent border-l border-r border-gray-200 dark:border-[#f6f6f4]/5">
                {capabilities.map((capability) => (
                  <div key={capability.title} className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-auto py-6">
                    <div className="flex flex-col justify-start">
                      <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-geist-sans text-left">
                        {capability.title}
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">What It Does</h5>
                          <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{capability.description}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">How It Works</h5>
                          <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{capability.how}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">Key Features</h5>
                          <ul className="space-y-1">
                            {capability.features.map((feature) => (
                              <li key={feature} className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans flex items-start">
                                <span className="mr-2">•</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 py-8 flex flex-col bg-transparent border-l border-r border-b section-border">
                <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-3 font-geist-sans">
                  The view unlocks when you scale
                </h4>
                <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans leading-relaxed mb-4">
                  {FLEET_GATING_COPY}
                </p>
                <a
                  href="https://docs.igrisinertial.com/overture"
                  className="inline-flex items-center justify-start bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg w-fit"
                >
                  View Fleet Documentation
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
