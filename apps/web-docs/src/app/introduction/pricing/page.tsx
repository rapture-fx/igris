import { pricing } from '@schlep/pricing-config'

export default function PricingPage() {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  };

  const tiers = [
    {
      key: 'starter',
      name: pricing.tiers.starter.name,
      price: pricing.tiers.starter.base_price_monthly,
      features: [
        `${formatNumber(pricing.tiers.starter.inference_included_cpu)} CPU inferences/month`,
        `${pricing.tiers.starter.models_included} CPU model deployments`,
        'gRPC + REST inference APIs',
        'Basic monitoring',
        `${pricing.tiers.starter.sla_uptime}% SLA uptime`,
        'Community support'
      ]
    },
    {
      key: 'professional',
      name: pricing.tiers.professional.name,
      price: pricing.tiers.professional.base_price_monthly,
      popular: true,
      features: [
        `${formatNumber(pricing.tiers.professional.inference_included_cpu)} CPU + ${formatNumber(pricing.tiers.professional.inference_included_gpu)} GPU inferences/month`,
        `${pricing.tiers.professional.models_included} model deployments (CPU + GPU)`,
        'GPU acceleration (CUDA/TensorRT)',
        'Multi-Model Routing (Thompson Sampling)',
        'Streaming Inference (WebSocket/SSE)',
        'Advanced monitoring dashboard',
        `${pricing.tiers.professional.sla_uptime}% SLA uptime`,
        '24/7 email support'
      ]
    },
    {
      key: 'enterprise',
      name: pricing.tiers.enterprise.name,
      price: pricing.tiers.enterprise.base_price_monthly,
      features: [
        `${formatNumber(pricing.tiers.enterprise.inference_included_cpu)} CPU + ${formatNumber(pricing.tiers.enterprise.inference_included_gpu)} GPU inferences/month`,
        `${pricing.tiers.enterprise.models_included} model deployments (CPU + GPU)`,
        'Priority GPU access',
        'Drift detection & monitoring',
        'Distributed tracing (Jaeger access)',
        'Custom SLA agreements',
        'Dedicated account manager',
        `${pricing.tiers.enterprise.sla_uptime}% SLA uptime`,
        'Priority support (<4hr response)'
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        Pricing Plans
      </h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          Choose the right plan for your inference orchestration needs. All plans include our high-performance ML inference platform.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12 not-prose">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`border rounded-lg p-6 relative ${
                tier.popular ? 'border-2 border-blue-500' : 'border-gray-200'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{tier.name}</h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">${tier.price}</div>
                <div className="text-gray-600 text-sm mb-6">per month</div>
              </div>

              <ul className="space-y-3 mb-8 text-sm">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                      ✓
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                tier.popular
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}>
                Get Started
              </button>
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Usage-Based Pricing</h2>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How We Count Inferences</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Each inference request (CPU or GPU) counts toward your monthly limit</li>
            <li>• Failed requests don't count against your quota</li>
            <li>• Monitoring and health checks are included at no extra cost</li>
            <li>• CPU overages: ${pricing.tiers.professional.overage_cpu_per_1k} per 1,000 inferences</li>
            <li>• GPU overages: ${pricing.tiers.professional.overage_gpu_per_1k} per 1,000 inferences (Professional+)</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Model Deployments</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Included Models</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Extra CPU Model</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Extra GPU Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">{pricing.tiers.starter.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{pricing.tiers.starter.models_included} (CPU only)</td>
                <td className="px-4 py-3 text-sm text-gray-600">${pricing.tiers.starter.extra_model_cpu_monthly}/month</td>
                <td className="px-4 py-3 text-sm text-gray-600">Not available</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">{pricing.tiers.professional.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{pricing.tiers.professional.models_included} (CPU + GPU)</td>
                <td className="px-4 py-3 text-sm text-gray-600">${pricing.tiers.professional.extra_model_cpu_monthly}/month</td>
                <td className="px-4 py-3 text-sm text-gray-600">${pricing.tiers.professional.extra_model_gpu_monthly}/month</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">{pricing.tiers.enterprise.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{pricing.tiers.enterprise.models_included} (CPU + GPU)</td>
                <td className="px-4 py-3 text-sm text-gray-600">${pricing.tiers.enterprise.extra_model_cpu_monthly}/month</td>
                <td className="px-4 py-3 text-sm text-gray-600">${pricing.tiers.enterprise.extra_model_gpu_monthly}/month</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Frequently Asked Questions</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I change plans anytime?</h3>
            <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">What happens if I exceed my inference limit?</h3>
            <p className="text-gray-600">You'll be charged per 1,000 additional inferences. We'll notify you as you approach your limit.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Do you offer annual discounts?</h3>
            <p className="text-gray-600">Yes! Annual plans receive a 15% discount. Contact sales for Enterprise annual pricing.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
            <p className="text-gray-600">All paid plans include a 14-day free trial. No credit card required to start.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">What ML frameworks are supported?</h3>
            <p className="text-gray-600">We support all major ML frameworks including TensorFlow, PyTorch, scikit-learn, XGBoost, and more. Deploy models trained in any framework.</p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-12">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Need Help Choosing?
          </h3>
          <p className="text-blue-700 mb-4">
            Not sure which plan is right for you? Our team is here to help you find the perfect fit for your inference workloads.
          </p>
          <a href="mailto:sales@schlepengine.com" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors">
            Contact Sales Team
          </a>
        </div>
      </div>
    </div>
  )
}
