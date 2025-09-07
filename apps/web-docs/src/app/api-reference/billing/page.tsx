import { ApiLayout } from '@/components/ui/ApiLayout'

export default function BillingApiPage() {

  return (
    <ApiLayout 
      title="Billing API"
      description="Manage billing, subscriptions, and usage."
      
    >
      <section className="mb-12" id="get-usage-statistics">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Usage Statistics</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/billing/usage</code>
          </div>
          <p className="text-gray-600 mb-4">Get the authenticated user's usage statistics.</p>
        </div>
      </section>

      <section className="mb-12" id="get-subscription-details">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Subscription Details</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/billing/subscription</code>
          </div>
          <p className="text-gray-600 mb-4">Get the authenticated user's subscription details.</p>
        </div>
      </section>

      <section className="mb-12" id="create-usage-record">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Usage Record</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/billing/usage-records</code>
          </div>
          <p className="text-gray-600 mb-4">Create a new usage record.</p>
        </div>
      </section>

      <section className="mb-12" id="get-invoices">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Invoices</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/billing/invoices</code>
          </div>
          <p className="text-gray-600 mb-4">Get a list of the authenticated user's invoices.</p>
        </div>
      </section>

      <section className="mb-12" id="get-invoice">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Invoice</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/billing/invoices/{'{invoice_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Get a specific invoice by ID.</p>
        </div>
      </section>

      <section className="mb-12" id="create-checkout-session">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Checkout Session</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/billing/checkout-session</code>
          </div>
          <p className="text-gray-600 mb-4">Create a new checkout session for subscription or one-time payment.</p>
        </div>
      </section>

      <section className="mb-12" id="create-customer-portal-session">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Customer Portal Session</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/billing/customer-portal</code>
          </div>
          <p className="text-gray-600 mb-4">Create a customer portal session.</p>
        </div>
      </section>

      <section className="mb-12" id="handle-webhook">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Handle Webhook</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/billing/webhook</code>
          </div>
          <p className="text-gray-600 mb-4">Handle incoming webhooks from the payment provider.</p>
        </div>
      </section>
    </ApiLayout>
  )
}