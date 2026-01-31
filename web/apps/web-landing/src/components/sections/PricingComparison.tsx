'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

interface PricingTier {
  name: string;
  price: string;
  priceDetail: string;
  description: string;
  devices: string;
  features: string[];
  cta: string;
  isContactUs?: boolean;
  highlight?: boolean;
}

interface PricingComparisonProps {
  tiers: PricingTier[];
  recommendedTier: string;
}

interface ComparisonFeature {
  category: string;
  features: {
    name: string;
    values: (string | boolean)[];
  }[];
}

export default function PricingComparison({ tiers, recommendedTier }: PricingComparisonProps) {
  const comparisonFeatures: ComparisonFeature[] = [
    {
      category: 'Runtime Devices',
      features: [
        {
          name: 'Runtime devices included',
          values: ['1 device', 'Up to 100 devices', 'Unlimited devices']
        },
        {
          name: 'Device management',
          values: [true, true, true]
        }
      ]
    },
    {
      category: 'Overture Fleet Dashboard (Included Free)',
      features: [
        {
          name: 'Dashboard access',
          values: ['Basic', 'Advanced', 'Advanced']
        },
        {
          name: 'QR code device pairing',
          values: [true, true, true]
        },
        {
          name: 'Real-time status monitoring',
          values: [true, true, true]
        },
        {
          name: 'Over-the-air model updates',
          values: ['Manual', 'One-click fleet-wide', 'One-click fleet-wide']
        },
        {
          name: 'Configuration sync',
          values: [true, true, true]
        },
        {
          name: 'Fleet analytics & logs',
          values: ['Basic', 'Advanced', 'Advanced']
        }
      ]
    },
    {
      category: 'Runtime Features',
      features: [
        {
          name: '16MB binary (no Docker)',
          values: [true, true, true]
        },
        {
          name: 'BYOM - bring your own GGUF model',
          values: [true, true, true]
        },
        {
          name: 'Offline operation',
          values: [true, true, true]
        },
        {
          name: 'Sandboxed execution with limits',
          values: [true, true, true]
        },
        {
          name: 'Local model support (Phi-3, Llama, Mistral)',
          values: [true, true, true]
        }
      ]
    },
    {
      category: 'Support',
      features: [
        {
          name: 'Community support (Discord)',
          values: [true, true, true]
        },
        {
          name: 'Email support',
          values: [false, true, true]
        },
        {
          name: 'Priority support',
          values: [false, true, true]
        },
        {
          name: 'SLA guarantee',
          values: [false, false, true]
        },
        {
          name: 'Log retention',
          values: ['None', '7 days', '90 days']
        }
      ]
    },
    {
      category: 'Advanced Features',
      features: [
        {
          name: 'Model deployment management',
          values: ['Manual', 'One-click', 'One-click + rollback']
        },
        {
          name: 'Group-based device management',
          values: [false, true, true]
        },
        {
          name: 'SSO & access controls',
          values: [false, false, true]
        },
        {
          name: 'Security audit support',
          values: [false, false, true]
        },
        {
          name: 'On-premise deployment',
          values: ['Self-hosted option', 'Self-hosted option', 'Included']
        }
      ]
    }
  ];

  const renderCellValue = (value: string | boolean) => {
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
          Compare features across all tiers. Overture Fleet Dashboard included with every plan.
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
          <tbody className="bg-[#f6f6f4] dark:bg-[#1b1912]">
            {comparisonFeatures.map((category, categoryIdx) => (
              <React.Fragment key={categoryIdx}>
                <tr className="bg-[#f6f6f4] dark:bg-[#1b1912] border-b section-border">
                  <td
                    colSpan={tiers.length + 1}
                    className="py-2 pl-4 pr-3 text-left text-xs font-bold text-gray-900 dark:text-[#f6f6f4] sm:pl-6"
                  >
                    {category.category}
                  </td>
                </tr>
                {category.features.map((feature, featureIdx) => (
                  <tr key={featureIdx} className="border-b section-border">
                     <td className="sticky left-0 z-10 bg-[#f6f6f4] dark:bg-[#1b1912] whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-gray-900 dark:text-[#f6f6f4] sm:pl-6">
                      {feature.name}
                    </td>
                    {feature.values.map((value, valueIdx) => (
                      <td
                        key={valueIdx}
                        className={`whitespace-nowrap px-3 py-3 text-center transition-colors duration-500 ${
                          tiers[valueIdx].name === recommendedTier ? 'bg-[#c5b0cd]/5' : 'bg-[#f6f6f4] dark:bg-[#1b1912]'
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
