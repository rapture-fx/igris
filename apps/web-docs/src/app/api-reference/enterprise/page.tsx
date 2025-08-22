import { ApiLayout } from '@/components/ui/ApiLayout'
import { ShieldCheckIcon, CogIcon, UsersIcon } from '@heroicons/react/24/outline'

export default function EnterpriseApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Get enterprise configuration
curl -X GET "https://api.schlep-engine.com/api/v1/enterprise/config" \\
  -H "Authorization: Bearer sk_your_enterprise_key"

# Set organization limits
curl -X POST "https://api.schlep-engine.com/api/v1/enterprise/limits" \\
  -H "Authorization: Bearer sk_your_enterprise_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organization_id": "org_12345",
    "api_calls_per_month": 10000000,
    "storage_limit_gb": 1000,
    "team_member_limit": 100
  }'`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_enterprise_key"
headers = {"Authorization": f"Bearer {api_key}"}

# Get enterprise configuration
config_response = requests.get(
    "https://api.schlep-engine.com/api/v1/enterprise/config",
    headers=headers
)

if config_response.status_code == 200:
    config = config_response.json()
    print(f"✅ Enterprise features enabled: {config['features']}")
    
    # Set organization limits
    limits_data = {
        "organization_id": "org_12345",
        "api_calls_per_month": 10000000,
        "storage_limit_gb": 1000,
        "team_member_limit": 100
    }
    
    limits_response = requests.post(
        "https://api.schlep-engine.com/api/v1/enterprise/limits",
        headers=headers,
        json=limits_data
    )
    
    if limits_response.status_code == 200:
        print("✅ Organization limits updated")
    else:
        print(f"❌ Failed to update limits: {limits_response.text}")
        
else:
    print(f"❌ Failed to get config: {config_response.text}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_enterprise_key';

// Get enterprise configuration
async function getEnterpriseConfig() {
  try {
    const response = await fetch('https://api.schlep-engine.com/api/v1/enterprise/config', {
      headers: {
        'Authorization': \`Bearer \${apiKey}\`
      }
    });

    if (response.ok) {
      const config = await response.json();
      console.log(\`✅ Enterprise features enabled: \${config.features}\`);
      
      // Set organization limits
      const limitsResponse = await fetch('https://api.schlep-engine.com/api/v1/enterprise/limits', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${apiKey}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization_id: 'org_12345',
          api_calls_per_month: 10000000,
          storage_limit_gb: 1000,
          team_member_limit: 100
        })
      });
      
      if (limitsResponse.ok) {
        console.log('✅ Organization limits updated');
      } else {
        console.error('❌ Failed to update limits:', await limitsResponse.text());
      }
    } else {
      console.error('❌ Failed to get config:', await response.text());
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

getEnterpriseConfig();`
    }
  ]

  return (
    <ApiLayout 
      title="Enterprise API"
      description="Manage enterprise organizations, advanced security, compliance, and administrative features for large-scale deployments."
      codeExamples={codeExamples}
    >
      {/* Enterprise Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Enterprise API Overview</h2>
        <p className="text-gray-600 mb-6">
          The Enterprise API provides advanced administrative capabilities for organizations requiring 
          enterprise-grade security, compliance, and management features. These endpoints are available 
          only to enterprise customers with appropriate permissions.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Advanced Security</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Enterprise-grade security features including SAML SSO, advanced audit logs, and compliance controls.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <UsersIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Organization Management</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Centralized management of teams, permissions, and resource allocation across large organizations.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CogIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Custom Configuration</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Flexible configuration options, custom limits, and white-label deployment capabilities.
            </p>
          </div>
        </div>
      </section>

      {/* Get Enterprise Configuration */}
      <section className="mb-12" id="get-enterprise-config">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Enterprise Configuration</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/enterprise/config</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get the current enterprise configuration including enabled features, limits, and organization settings.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "organization_id": "org_12345",
  "plan": "enterprise",
  "features": [
    "advanced_security",
    "custom_integrations", 
    "dedicated_support",
    "sla_guarantees",
    "audit_logs",
    "saml_sso"
  ],
  "limits": {
    "api_calls_per_month": 10000000,
    "storage_limit_gb": 1000,
    "team_members": 100,
    "concurrent_jobs": 50
  },
  "security_settings": {
    "ip_whitelist_enabled": true,
    "mfa_required": true,
    "session_timeout": 3600
  },
  "support": {
    "dedicated_manager": true,
    "sla_level": "premium",
    "phone_support": true
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Set Organization Limits */}
      <section className="mb-12" id="set-organization-limits">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Set Organization Limits</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/enterprise/limits</code>
          </div>
          <p className="text-gray-600 mb-4">
            Configure custom limits and quotas for an organization within your enterprise account.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">organization_id</code> (string, required) - Organization identifier</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">api_calls_per_month</code> (int, optional) - Monthly API call limit</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">storage_limit_gb</code> (int, optional) - Storage limit in GB</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">team_member_limit</code> (int, optional) - Maximum team members</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">concurrent_jobs</code> (int, optional) - Concurrent processing jobs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Get Organization Usage */}
      <section className="mb-12" id="get-organization-usage">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Organization Usage</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/enterprise/organizations/{'{org_id}'}/usage</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get detailed usage statistics and metrics for a specific organization.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "organization_id": "org_12345",
  "current_period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "usage": {
    "api_calls": 2500000,
    "storage_used_gb": 245.6,
    "team_members": 47,
    "active_jobs": 12
  },
  "limits": {
    "api_calls_per_month": 10000000,
    "storage_limit_gb": 1000,
    "team_member_limit": 100,
    "concurrent_jobs": 50
  },
  "utilization": {
    "api_calls_percentage": 25.0,
    "storage_percentage": 24.6,
    "team_percentage": 47.0
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Enterprise Audit Logs */}
      <section className="mb-12" id="get-audit-logs">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Audit Logs</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/enterprise/audit-logs</code>
          </div>
          <p className="text-gray-600 mb-4">
            Retrieve comprehensive audit logs for security compliance and monitoring purposes.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Query Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">organization_id</code> (string, optional) - Filter by organization</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">user_id</code> (string, optional) - Filter by user</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">action</code> (string, optional) - Filter by action type</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">start_date</code> (string, optional) - Start date (ISO 8601)</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">end_date</code> (string, optional) - End date (ISO 8601)</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">limit</code> (int, optional) - Max results (default: 100)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Configure SSO */}
      <section className="mb-12" id="configure-sso">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Configure SAML SSO</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/enterprise/sso/configure</code>
          </div>
          <p className="text-gray-600 mb-4">
            Configure SAML SSO settings for enterprise single sign-on integration.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "organization_id": "org_12345",
  "provider": "okta",
  "saml_settings": {
    "idp_url": "https://company.okta.com/app/schlep/exk.../sso/saml",
    "idp_certificate": "-----BEGIN CERTIFICATE-----\\n...",
    "entity_id": "http://www.okta.com/exk...",
    "attribute_mapping": {
      "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "first_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
      "last_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
    }
  },
  "enforce_sso": true,
  "auto_provision": true
}`}
            </pre>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}