'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

interface UsageTier {
  name: string;
  basePrice: number;
  includedRequests: number;
  overageRate: number;
  hardLimit: number;
  providers: number;
  descriptor: string;
  authorityLevel: 'observe' | 'influence' | 'enforce' | 'prove';
  features: string[];
  cta: string;
  isContactUs?: boolean;
  minimumCommitment?: number;
}

interface PricingComparisonProps {
  tiers: UsageTier[];
  recommendedTier: string;
}

interface ComparisonFeature {
  category: string;
  features: {
    name: string;
    values: (string | boolean | number)[];
  }[];
}

export default function PricingComparison({ tiers, recommendedTier }: PricingComparisonProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const comparisonFeatures: ComparisonFeature[] = [
    {
      category: 'Usage & Limits',
      features: [
        {
          name: 'Monthly requests (hard limit)',
          values: tiers.map(t =>
            t.isContactUs ? 'Unlimited' : formatNumber(t.hardLimit)
          )
        },
        {
          name: 'AI provider limit',
          values: tiers.map(t =>
            t.isContactUs ? 'Unlimited' : t.providers.toString()
          )
        },
        {
          name: 'Pricing model',
          values: [
            'Free',
            'Usage-based',
            'Usage-based',
            'Custom'
          ]
        }
      ]
    },
    {
      category: 'Overture: Routing & Decision Intelligence',
      features: [
        {
          name: 'Basic routing (cost/latency)',
          values: [true, true, true, true]
        },
        {
          name: 'Thompson Sampling (ML-based)',
          values: [false, true, true, true]
        },
        {
          name: 'Semantic routing',
          values: [false, true, true, true]
        },
        {
          name: 'Adaptive routing with live learning',
          values: [false, false, true, true]
        },
        {
          name: 'Council mode (reduced hallucinations)',
          values: [false, false, true, true]
        },
        {
          name: 'Speculative execution (2-4 parallel)',
          values: [false, false, true, true]
        },
        {
          name: 'Adaptive circuit breaker',
          values: [true, true, true, true]
        },
        {
          name: 'High-performance cache',
          values: [false, true, true, true]
        }
      ]
    },
    {
      category: 'Overture: Policy & Governance',
      features: [
        {
          name: 'Policy engine (SLAs, compliance)',
          values: [false, true, true, true]
        },
        {
          name: 'Real-time cost tracking (USD)',
          values: [true, true, true, true]
        },
        {
          name: 'Budget enforcement',
          values: [false, true, true, true]
        },
        {
          name: 'Geo-fencing & compliance',
          values: [false, false, true, true]
        }
      ]
    },
    {
      category: 'Runtime: Execution & Safety',
      features: [
        {
          name: 'Basic execution',
          values: [true, true, true, true]
        },
        {
          name: 'Runtime license included',
          values: [false, false, true, true]
        },
        {
          name: 'Sandboxed execution with limits',
          values: [false, false, true, true]
        },
        {
          name: 'HMAC-signed tamper-proof envelopes',
          values: [false, false, true, true]
        },
        {
          name: 'Multi-provider consensus execution',
          values: [false, false, true, true]
        }
      ]
    },
    {
      category: 'Runtime: Offline & Edge',
      features: [
        {
          name: 'Offline operation',
          values: [false, false, true, true]
        },
        {
          name: 'Local models (Phi-3, GGUF)',
          values: [false, false, true, true]
        },
        {
          name: 'Semantic cache (30-50% reduction)',
          values: [false, false, true, true]
        },
        {
          name: 'LoRA fine-tuning with GPU',
          values: [false, false, true, true]
        },
        {
          name: 'Device-locked encrypted adapters',
          values: [false, false, true, true]
        }
      ]
    },
    {
      category: 'Observability & Transparency',
      features: [
        {
          name: 'Cost visibility',
          values: [true, true, true, true]
        },
        {
          name: 'Log retention',
          values: ['7 days', '14 days', '30 days', '90 days']
        },
        {
          name: 'Decision explanations',
          values: [true, true, true, true]
        },
        {
          name: '180+ Prometheus metrics',
          values: [false, true, true, true]
        },
        {
          name: 'OpenTelemetry traces',
          values: [false, true, true, true]
        },
        {
          name: 'Real-time telemetry streaming',
          values: [false, false, true, true]
        },
        {
          name: 'Cryptographic audit trail',
          values: [false, false, false, true]
        }
      ]
    },
    {
      category: 'Security & Enterprise',
      features: [
        {
          name: 'Multi-tenancy with isolation',
          values: [false, false, true, true]
        },
        {
          name: 'Encrypted API key storage (BYOK)',
          values: [true, true, true, true]
        },
        {
          name: 'Fleet-wide tenant isolation',
          values: [false, false, false, true]
        }
      ]
    },
    {
      category: 'Support',
      features: [
        {
          name: 'Community support',
          values: [true, true, true, true]
        },
        {
          name: 'Email support',
          values: [false, true, true, true]
        },
        {
          name: 'Priority support with SLA',
          values: [false, false, false, true]
        }
      ]
    }
  ];

  const renderCellValue = (value: string | boolean | number) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
      ) : (
        <X className="h-4 w-4 text-gray-400 dark:text-gray-600 mx-auto" />
      );
    }
    return (
      <span className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter">
        {value}
      </span>
    );
  };

  return (
    <div className="mt-16 mb-12">
      <div className="text-center mb-8">
        <h3 className="text-xl md:text-2xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
          Feature Comparison
        </h3>
        <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter">
          Compare features across all tiers
        </p>
      </div>

      <div className="overflow-x-auto border section-border">
        <table className="min-w-full">
          <thead className="bg-[#f6f6f4] dark:bg-[#1b1912] border-b section-border">
            <tr>
              <th scope="col" className="bg-[#f6f6f4] dark:bg-[#1b1912] py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 dark:text-[#f6f6f4] sm:pl-6 border-r section-border">
                Feature
              </th>
              {tiers.map((tier, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={`px-3 py-3 text-center text-xs font-semibold text-gray-900 dark:text-[#f6f6f4] transition-colors duration-500 border-r section-border ${
                    tier.name === recommendedTier ? 'bg-[#c5b0cd]/20 dark:bg-[#c5b0cd]/10' : 'bg-[#f6f6f4] dark:bg-[#1b1912]'
                  }`}
                >
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#14120a]">
            {comparisonFeatures.map((category, categoryIdx) => (
              <React.Fragment key={categoryIdx}>
                <tr className="bg-gray-100 dark:bg-[#1b1912] border-b section-border">
                  <td
                    colSpan={tiers.length + 1}
                    className="py-2 pl-4 pr-3 text-left text-xs font-bold text-gray-900 dark:text-[#f6f6f4] sm:pl-6"
                  >
                    {category.category}
                  </td>
                </tr>
                {category.features.map((feature, featureIdx) => (
                  <tr key={featureIdx} className="border-b section-border">
                    <td className="sticky left-0 z-10 bg-white dark:bg-[#14120a] whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-gray-900 dark:text-[#f6f6f4] sm:pl-6">
                      {feature.name}
                    </td>
                    {feature.values.map((value, valueIdx) => (
                      <td
                        key={valueIdx}
                        className={`whitespace-nowrap px-3 py-3 text-center transition-colors duration-500 ${
                          tiers[valueIdx].name === recommendedTier ? 'bg-[#c5b0cd]/5' : ''
                        }`}
                      >
                        {renderCellValue(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
