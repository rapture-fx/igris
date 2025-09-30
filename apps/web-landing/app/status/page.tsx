import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react'

export default function StatusPage() {
  // In production, this would fetch real-time data from monitoring API
  const services = [
    {
      name: 'API Gateway',
      status: 'operational',
      uptime: '99.98%',
      responseTime: '45ms',
      endpoint: 'https://api.schlep-engine.com'
    },
    {
      name: 'ML Pipeline',
      status: 'operational',
      uptime: '99.95%',
      responseTime: '180ms',
      endpoint: 'https://api.schlep-engine.com/api/v1/ml'
    },
    {
      name: 'Data Processing',
      status: 'operational',
      uptime: '99.97%',
      responseTime: '120ms',
      endpoint: 'https://api.schlep-engine.com/api/v1/data'
    },
    {
      name: 'Authentication',
      status: 'operational',
      uptime: '99.99%',
      responseTime: '32ms',
      endpoint: 'https://api.schlep-engine.com/api/v1/auth'
    },
    {
      name: 'Documentation',
      status: 'operational',
      uptime: '99.96%',
      responseTime: '25ms',
      endpoint: 'https://docs.schlep-engine.com'
    },
    {
      name: 'Admin Dashboard',
      status: 'operational',
      uptime: '99.94%',
      responseTime: '38ms',
      endpoint: 'https://admin.schlep-engine.com'
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'outage':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'outage':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f7f3' }}>
      <Header />
      <main className="pt-36 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-normal mb-4" style={{ color: '#1f53d0' }}>
              System Status
            </h1>
            <p className="text-gray-600 text-lg">
              Real-time status and uptime metrics for Schlep-Engine services
            </p>
          </div>

          {/* Overall Status */}
          <div className="mb-8 p-6 rounded-lg border border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <h2 className="text-xl font-medium text-gray-900">All Systems Operational</h2>
                  <p className="text-sm text-gray-600">Last updated: {new Date().toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-gray-900">99.7%</div>
                <div className="text-sm text-gray-600">30-day uptime</div>
              </div>
            </div>
          </div>

          {/* Services Status */}
          <div className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Services</h2>
            {services.map((service, index) => (
              <div
                key={index}
                className="p-5 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                style={{ backgroundColor: '#f2f1ed' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <h3 className="font-medium text-gray-900">{service.name}</h3>
                      <p className="text-sm text-gray-500">{service.endpoint}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </span>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Uptime: </span>
                    <span className="font-medium text-gray-900">{service.uptime}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Response Time: </span>
                    <span className="font-medium text-gray-900">{service.responseTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Incident History */}
          <div className="mt-12">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Recent Incidents</h2>
            <div className="p-6 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: '#f2f1ed' }}>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">No incidents reported in the last 30 days</p>
            </div>
          </div>

          {/* SLA Information */}
          <div className="mt-12 p-6 rounded-lg border border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
            <h2 className="text-xl font-medium text-gray-900 mb-4">Service Level Agreements</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Develop Tier</div>
                <div className="text-2xl font-semibold" style={{ color: '#1f53d0' }}>99.0%</div>
                <div className="text-xs text-gray-500">Guaranteed uptime</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Growth Tier</div>
                <div className="text-2xl font-semibold" style={{ color: '#1f53d0' }}>99.5%</div>
                <div className="text-xs text-gray-500">Guaranteed uptime</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Scale Tier</div>
                <div className="text-2xl font-semibold" style={{ color: '#1f53d0' }}>99.9%</div>
                <div className="text-xs text-gray-500">Guaranteed uptime</div>
              </div>
            </div>
          </div>

          {/* Subscribe to Updates */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              Subscribe to status updates at{' '}
              <a href="mailto:status@schlep-engine.com" className="text-blue-600 hover:underline">
                status@schlep-engine.com
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}