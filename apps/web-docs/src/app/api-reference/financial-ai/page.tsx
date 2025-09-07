'use client'

import { ApiLayout } from '@/components/ui/ApiLayout'
import { ShieldCheckIcon, CurrencyDollarIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function FinancialAIApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Real-time Fraud Detection Analysis
curl -X POST "https://api.schlep-engine.com/api/v1/industry/financial/fraud-detection" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_id": "txn_001_abc123",
    "user_id": "user_456789",
    "transaction_amount": 2500.00,
    "merchant_category": "electronics",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "country": "US",
      "ip_address": "192.168.1.100"
    },
    "device_info": {
      "device_id": "device_xyz789",
      "browser": "Chrome/91.0",
      "user_agent": "Mozilla/5.0...",
      "screen_resolution": "1920x1080"
    },
    "historical_behavior": {
      "avg_transaction_amount": 150.00,
      "transaction_frequency": 12,
      "preferred_merchants": ["grocery", "gas", "restaurants"]
    },
    "real_time": true
  }'

# Response
{
  "success": true,
  "data": {
    "transaction_id": "txn_001_abc123",
    "is_fraudulent": false,
    "fraud_probability": 0.23,
    "risk_level": "LOW",
    "risk_factors": [
      {
        "factor": "unusual_amount",
        "score": 0.35,
        "description": "Transaction amount significantly higher than average"
      },
      {
        "factor": "new_device",
        "score": 0.18,
        "description": "Transaction from previously unseen device"
      }
    ],
    "recommendations": [
      "Monitor user for next 24 hours",
      "Consider additional verification for similar amounts"
    ]
  }
}

# Get Available Financial Models
curl -X GET "https://api.schlep-engine.com/api/v1/industry/financial/models" \\
  -H "Authorization: Bearer sk_your_api_key"

# Response
{
  "success": true,
  "data": [
    {
      "model_id": "fraud_detection_v2.1",
      "model_name": "Advanced Fraud Detection",
      "version": "2.1.0",
      "accuracy": 0.964,
      "last_trained": "2024-01-10T08:00:00Z",
      "status": "operational"
    },
    {
      "model_id": "credit_risk_v1.8",
      "model_name": "Credit Risk Assessment",
      "version": "1.8.2",
      "accuracy": 0.887,
      "last_trained": "2024-01-08T14:30:00Z",
      "status": "operational"
    }
  ]
}`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests
import pandas as pd

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}

# Credit Risk Assessment
credit_assessment_data = {
    "applicant_id": "applicant_789456",
    "personal_info": {
        "age": 35,
        "annual_income": 75000,
        "employment_years": 8,
        "marital_status": "married",
        "dependents": 2
    },
    "financial_info": {
        "existing_debt": 25000,
        "monthly_expenses": 3500,
        "savings_account_balance": 15000,
        "checking_account_balance": 2800
    },
    "credit_history": {
        "credit_score": 720,
        "credit_history_length": 12,
        "number_of_accounts": 8,
        "payment_history": "excellent"
    },
    "employment_info": {
        "employer": "Tech Corp Inc",
        "job_title": "Software Engineer",
        "employment_type": "full_time",
        "employer_industry": "technology"
    },
    "requested_amount": 50000,
    "loan_purpose": "home_improvement"
}

response = requests.post(
    "https://api.schlep-engine.com/api/v1/industry/financial/credit-risk",
    headers=headers,
    json=credit_assessment_data
)

result = response.json()
print(f"Credit Risk Level: {result['data']['risk_level']}")
print(f"Approval Recommendation: {result['data']['recommendation']}")
print(f"Suggested Interest Rate: {result['data']['suggested_interest_rate']}%")

# AML Compliance Check
aml_check_data = {
    "customer_id": "cust_aml_001",
    "customer_info": {
        "full_name": "John David Smith",
        "date_of_birth": "1985-03-15",
        "nationality": "US",
        "address": {
            "street": "123 Main Street",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "US"
        },
        "occupation": "Business Owner",
        "industry": "import_export"
    },
    "transaction_data": [
        {
            "amount": 25000,
            "currency": "USD",
            "counterparty": "ABC Trading Ltd",
            "country": "UK",
            "date": "2024-01-15"
        }
    ],
    "watchlist_check": True,
    "pep_check": True,
    "sanctions_check": True
}

aml_response = requests.post(
    "https://api.schlep-engine.com/api/v1/industry/financial/aml-check",
    headers=headers,
    json=aml_check_data
)

aml_result = aml_response.json()
print(f"AML Risk Level: {aml_result['data']['risk_level']}")
print(f"Requires Further Review: {aml_result['data']['requires_review']}")

# Get available models
models_response = requests.get(
    "https://api.schlep-engine.com/api/v1/industry/financial/models",
    headers=headers
)

models = models_response.json()
for model in models['data']:
    print(f"Model: {model['model_name']} v{model['version']} - Accuracy: {model['accuracy']}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const api_key = "sk_your_api_key";

// Comprehensive fraud detection
async function detectFraud(transactionData) {
  const response = await fetch('https://api.schlep-engine.com/api/v1/industry/financial/fraud-detection', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${api_key}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(transactionData)
  });
  
  const result = await response.json();
  return result.data;
}

// Credit risk assessment with detailed parameters
async function assessCreditRisk(applicantData) {
  const response = await fetch('https://api.schlep-engine.com/api/v1/industry/financial/credit-risk', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${api_key}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(applicantData)
  });
  
  const result = await response.json();
  return result.data;
}

// Get available financial models
async function getFinancialModels() {
  const response = await fetch('https://api.schlep-engine.com/api/v1/industry/financial/models', {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${api_key}\`
    }
  });
  
  const result = await response.json();
  return result.data;
}

// Usage example
const transactionData = {
  transaction_id: 'txn_' + Date.now(),
  user_id: 'user_12345',
  transaction_amount: 1500.00,
  merchant_category: 'online_retail',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    country: 'US',
    ip_address: '203.0.113.1'
  },
  device_info: {
    device_id: 'device_abc123',
    browser: 'Safari/14.0',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    screen_resolution: '2560x1440'
  },
  historical_behavior: {
    avg_transaction_amount: 200.00,
    transaction_frequency: 8,
    preferred_merchants: ['online_retail', 'grocery', 'gas']
  },
  real_time: true
};

detectFraud(transactionData)
  .then(result => {
    console.log('Fraud Detection Result:', result.risk_level);
    console.log('Fraud Probability:', result.fraud_probability);
    if (result.risk_factors.length > 0) {
      console.log('Risk Factors:', result.risk_factors);
    }
  })
  .catch(error => console.error('Error:', error));

// Check available models
getFinancialModels().then(models => {
  console.log('Available Models:');
  models.forEach(model => {
    console.log(\`- \${model.model_name} v\${model.version} (Status: \${model.status})\`);
  });
});`
    }
  ]

  const apiEndpoints = [
    {
      method: 'POST',
      path: '/api/v1/industry/financial/fraud-detection',
      description: 'Real-time fraud detection analysis with statistical risk scoring and pattern analysis',
      parameters: ['transaction_id', 'user_id', 'transaction_amount', 'merchant_category', 'location', 'device_info', 'historical_behavior', 'real_time']
    },
    {
      method: 'POST', 
      path: '/api/v1/industry/financial/credit-risk',
      description: 'Comprehensive credit risk assessment for loan applications with detailed applicant analysis',
      parameters: ['applicant_id', 'personal_info', 'financial_info', 'credit_history', 'employment_info', 'requested_amount', 'loan_purpose']
    },
    {
      method: 'POST',
      path: '/api/v1/industry/financial/aml-check', 
      description: 'Anti-Money Laundering compliance screening with watchlist, PEP, and sanctions checking',
      parameters: ['customer_id', 'customer_info', 'transaction_data', 'watchlist_check', 'pep_check', 'sanctions_check']
    },
    {
      method: 'GET',
      path: '/api/v1/industry/financial/models',
      description: 'List available financial models with performance metrics and operational status',
      parameters: []
    }
  ]

  return (
    <ApiLayout
      title="Financial Services API"
      description="Financial data processing services including fraud detection, credit risk assessment, and AML compliance screening using statistical models and rule-based analysis."
      icon={ShieldCheckIcon}
      codeExamples={codeExamples}
      apiEndpoints={apiEndpoints}
    />
  )
}