import { EndpointCard } from '@/components/ui/EndpointCard'

export default function BillingApiPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Billing API</h1>
        <p className="text-xl text-gray-600">
          Manage subscriptions, usage tracking, and billing through LemonSqueezy integration.
        </p>
      </div>

      <div className="space-y-8">
        <EndpointCard
          method="GET"
          path="/billing/usage"
          title="Get Usage Statistics"
          description="Retrieve current usage statistics and billing information for a specific time period."
          parameters={[
            {
              name: "start_date",
              type: "string",
              required: false,
              description: "Start date in YYYY-MM-DD format (defaults to 30 days ago)",
              example: "2024-01-01"
            },
            {
              name: "end_date", 
              type: "string",
              required: false,
              description: "End date in YYYY-MM-DD format (defaults to today)",
              example: "2024-01-31"
            },
            {
              name: "customer_id",
              type: "string",
              required: false,
              description: "LemonSqueezy customer ID for filtering",
              example: "customer_123456"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Usage statistics retrieved successfully",
              example: `{
  "total_requests": 5420,
  "data_processed": 85000000,
  "storage_used": 2500000000,
  "ml_operations": 245,
  "cost": 12.45,
  "period": "2024-01-01 to 2024-01-31",
  "currency": "USD"
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlepengine.com/v1/billing/usage?start_date=2024-01-01&end_date=2024-01-31" \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/billing/usage',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'start_date': '2024-01-01',
        'end_date': '2024-01-31',
        'customer_id': 'customer_123456'
    }
)

usage = response.json()
print(f"API calls: {usage['total_requests']}")
print(f"Total cost: \${usage['cost']}")`,
            javascript: `const params = new URLSearchParams({
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  customer_id: 'customer_123456'
});

fetch(\`https://api.schlepengine.com/v1/billing/usage?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(usage => {
  console.log(\`API calls: \${usage.total_requests}\`);
  console.log(\`Total cost: $\${usage.cost}\`);
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/billing/subscription/{subscription_id}"
          title="Get Subscription Details"
          description="Retrieve detailed information about a LemonSqueezy subscription including status, pricing, and renewal dates."
          parameters={[
            {
              name: "subscription_id",
              type: "string",
              required: true,
              description: "LemonSqueezy subscription ID",
              example: "sub_123456789"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Subscription details retrieved successfully", 
              example: `{
  "id": "sub_123456789",
  "status": "active",
  "variant_id": "variant_123",
  "variant_name": "Pro Plan",
  "customer_id": "customer_123456",
  "renews_at": "2024-02-15T10:30:00Z",
  "ends_at": null,
  "trial_ends_at": null,
  "price": 29.99,
  "currency": "USD",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}`
            },
            {
              status: 404,
              description: "Subscription not found",
              example: `{
  "detail": "Subscription not found"
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlepengine.com/v1/billing/subscription/sub_123456789 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/billing/subscription/sub_123456789',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    subscription = response.json()
    print(f"Plan: {subscription['variant_name']}")
    print(f"Status: {subscription['status']}")
    print(f"Price: \${subscription['price']}")
    print(f"Renews: {subscription['renews_at']}")`,
            javascript: `fetch('https://api.schlepengine.com/v1/billing/subscription/sub_123456789', {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(subscription => {
  console.log(\`Plan: \${subscription.variant_name}\`);
  console.log(\`Status: \${subscription.status}\`);
  console.log(\`Price: $\${subscription.price}\`);
  console.log(\`Renews: \${subscription.renews_at}\`);
});`
          }}
        />

        <EndpointCard
          method="POST"
          path="/billing/usage-record"
          title="Create Usage Record"
          description="Record usage for metered billing in LemonSqueezy. Used to track API calls, data processed, or other billable events."
          parameters={[
            {
              name: "subscription_id",
              type: "string", 
              required: true,
              description: "LemonSqueezy subscription ID to record usage for",
              example: "sub_123456789"
            },
            {
              name: "usage_type",
              type: "string",
              required: true,
              description: "Type of usage: api_requests, data_processed, storage_used, ml_operations",
              example: "api_requests"
            },
            {
              name: "quantity",
              type: "integer",
              required: true,
              description: "Quantity of usage to record",
              example: "100"
            },
            {
              name: "metadata",
              type: "object",
              required: false,
              description: "Optional metadata for the usage record",
              example: `{"endpoint": "/api/v1/upload", "file_size": 1048576}`
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Usage record created successfully",
              example: `{
  "data": {
    "type": "subscription-usage-records",
    "id": "usage_record_123",
    "attributes": {
      "quantity": 100,
      "action": "increment",
      "usage_type": "api_requests",
      "created_at": "2024-01-15T10:30:00Z"
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/billing/usage-record \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subscription_id": "sub_123456789",
    "usage_type": "api_requests", 
    "quantity": 100,
    "metadata": {"endpoint": "/api/v1/upload"}
  }'`,
            python: `import requests

response = requests.post(
    'https://api.schlepengine.com/v1/billing/usage-record',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json={
        'subscription_id': 'sub_123456789',
        'usage_type': 'api_requests',
        'quantity': 100,
        'metadata': {'endpoint': '/api/v1/upload'}
    }
)

print(f"Usage recorded: {response.status_code}")`,
            javascript: `fetch('https://api.schlepengine.com/v1/billing/usage-record', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subscription_id: 'sub_123456789',
    usage_type: 'api_requests',
    quantity: 100,
    metadata: { endpoint: '/api/v1/upload' }
  })
})
.then(response => response.json())
.then(result => {
  console.log('Usage recorded successfully');
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/billing/overview/{customer_id}"
          title="Get Billing Overview"
          description="Get comprehensive billing overview including subscription, usage, recent payments, and billing alerts."
          parameters={[
            {
              name: "customer_id",
              type: "string",
              required: true,
              description: "LemonSqueezy customer ID",
              example: "customer_123456"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Billing overview retrieved successfully",
              example: `{
  "subscription": {
    "id": "sub_123456789",
    "status": "active",
    "variant_name": "Pro Plan",
    "price": 29.99,
    "currency": "USD",
    "renews_at": "2024-02-15T10:30:00Z"
  },
  "usage": {
    "total_requests": 5420,
    "data_processed": 85000000,
    "storage_used": 2500000000,
    "ml_operations": 245,
    "cost": 12.45,
    "period": "2024-01-01 to 2024-01-31"
  },
  "recent_payments": [
    {
      "id": "payment_123",
      "amount": 29.99,
      "currency": "USD",
      "status": "paid",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "usage_records": [],
  "next_invoice_date": "2024-02-15T10:30:00Z",
  "billing_alerts": [
    "High usage detected this month"
  ]
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlepengine.com/v1/billing/overview/customer_123456 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/billing/overview/customer_123456',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

overview = response.json()
print(f"Subscription: {overview['subscription']['variant_name']}")
print(f"Current cost: $" + str(overview['usage']['cost']))
print(f"Next invoice: {overview['next_invoice_date']}")

if overview['billing_alerts']:
    print("Alerts:", overview['billing_alerts'])`,
            javascript: `fetch('https://api.schlepengine.com/v1/billing/overview/customer_123456', {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(overview => {
  console.log(\`Subscription: \${overview.subscription.variant_name}\`);
  console.log(\`Current cost: $\${overview.usage.cost}\`);
  console.log(\`Next invoice: \${overview.next_invoice_date}\`);
  
  if (overview.billing_alerts.length > 0) {
    console.log('Alerts:', overview.billing_alerts);
  }
});`
          }}
        />
      </div>
    </div>
  )
}