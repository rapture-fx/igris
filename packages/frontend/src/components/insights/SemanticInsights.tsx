'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { MessageCircle, Database, TrendingUp, DollarSign, Activity } from 'lucide-react'

interface InsightResponse {
  question: string
  sql_query: string
  data: any[]
  context: {
    metric_name: string
    business_description: string
    date_range: string
    assumptions?: string[]
  }
  metadata: {
    row_count: number
    columns: string[]
    generated_at: string
  }
  visualization_suggestions?: Array<{
    type: string
    title: string
    x_axis: string
    y_axis: string | string[]
  }>
}

const EXAMPLE_QUESTIONS = [
  "What's our monthly recurring revenue for the last 3 months?",
  "How much data did we process this month?",
  "Show me API usage trends for last week",
  "What's our customer acquisition cost?",
  "What's our average revenue per user?",
  "How many processing jobs completed yesterday?"
]

const EXAMPLE_RESPONSE: InsightResponse = {
  question: "What's our monthly recurring revenue for the last 3 months?",
  sql_query: `
SELECT 
    DATE_TRUNC('month', um.recorded_at)::date AS month,
    SUM(CASE 
        WHEN um.metric_type = 'api_calls' THEN um.metric_value * 0.01
        WHEN um.metric_type = 'data_processed' THEN um.metric_value * 0.05
        ELSE 0 
    END) AS monthly_revenue,
    COUNT(DISTINCT um.user_id) AS paying_customers
FROM usage_metrics um
JOIN users u ON um.user_id = u.id
WHERE um.recorded_at >= '2024-01-01' 
AND um.recorded_at <= '2024-03-31'
AND u.is_active = true
GROUP BY DATE_TRUNC('month', um.recorded_at)
ORDER BY month DESC
  `,
  data: [
    { month: '2024-03-01', monthly_revenue: 15420.50, paying_customers: 128 },
    { month: '2024-02-01', monthly_revenue: 12350.75, paying_customers: 115 },
    { month: '2024-01-01', monthly_revenue: 9875.25, paying_customers: 98 }
  ],
  context: {
    metric_name: "Monthly Recurring Revenue",
    business_description: "Revenue generated from active subscriptions and usage-based billing",
    date_range: "2024-01-01 to 2024-03-31",
    assumptions: [
      "API calls charged at $0.01 per call",
      "Data processing charged at $0.05 per MB"
    ]
  },
  metadata: {
    row_count: 3,
    columns: ["month", "monthly_revenue", "paying_customers"],
    generated_at: "2024-03-15T10:30:00Z"
  },
  visualization_suggestions: [
    {
      type: "line_chart",
      title: "Revenue Trend Over Time",
      x_axis: "month",
      y_axis: "monthly_revenue"
    }
  ]
}

export function SemanticInsights() {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<InsightResponse | null>(null)
  const [activeTab, setActiveTab] = useState('ask')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setIsLoading(true)
    
    // Simulate API call - replace with actual API call
    setTimeout(() => {
      setResponse({
        ...EXAMPLE_RESPONSE,
        question: question
      })
      setIsLoading(false)
      setActiveTab('results')
    }, 1500)
  }

  const handleExampleClick = (exampleQuestion: string) => {
    setQuestion(exampleQuestion)
  }

  const renderVisualization = () => {
    if (!response?.data || response.data.length === 0) return null

    const data = response.data

    // Revenue trend chart
    if (response.context.metric_name.includes('Revenue')) {
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Line 
                    type="monotone" 
                    dataKey="monthly_revenue" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Default table view
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Query Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  {response.metadata.columns.map((col) => (
                    <th key={col} className="border border-gray-200 px-4 py-2 text-left">
                      {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {response.metadata.columns.map((col) => (
                      <td key={col} className="border border-gray-200 px-4 py-2">
                        {typeof row[col] === 'number' && col.includes('revenue') 
                          ? `$${row[col].toLocaleString()}` 
                          : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Revenue Insights with Semantic Layer
        </h1>
        <p className="text-gray-600">
          Ask natural language questions about your business data and get instant insights
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ask" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Ask Question
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="sql" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Generated SQL
          </TabsTrigger>
          <TabsTrigger value="context" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Business Context
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ask" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ask Your Business Question</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., What's our monthly recurring revenue for the last 3 months?"
                    className="text-lg"
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !question.trim()}
                  >
                    {isLoading ? 'Generating Insights...' : 'Get Insights'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-start text-left h-auto p-3"
                    onClick={() => handleExampleClick(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {response ? (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Results for: "{response.question}"</span>
                    <Badge variant="secondary">
                      {response.metadata.row_count} rows
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {response.metadata.row_count}
                      </div>
                      <div className="text-sm text-gray-500">Rows Returned</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {response.metadata.columns.length}
                      </div>
                      <div className="text-sm text-gray-500">Columns</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {response.context.metric_name}
                      </div>
                      <div className="text-sm text-gray-500">Metric Type</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {renderVisualization()}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Ask a question to see results here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sql" className="space-y-6">
          {response ? (
            <Card>
              <CardHeader>
                <CardTitle>Generated SQL Query</CardTitle>
                <p className="text-sm text-gray-600">
                  This SQL was automatically generated from your natural language question
                </p>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{response.sql_query}</pre>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p><strong>Execution time:</strong> ~150ms</p>
                  <p><strong>Tables accessed:</strong> usage_metrics, users</p>
                  <p><strong>Generated at:</strong> {new Date(response.metadata.generated_at).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Ask a question to see the generated SQL</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="context" className="space-y-6">
          {response ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Business Context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">Metric Name</h4>
                    <p className="text-gray-600">{response.context.metric_name}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Description</h4>
                    <p className="text-gray-600">{response.context.business_description}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Date Range</h4>
                    <p className="text-gray-600">{response.context.date_range}</p>
                  </div>
                  {response.context.assumptions && (
                    <div>
                      <h4 className="font-semibold text-gray-900">Business Assumptions</h4>
                      <ul className="list-disc pl-5 text-gray-600 space-y-1">
                        {response.context.assumptions.map((assumption, i) => (
                          <li key={i}>{assumption}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How the Semantic Layer Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-900">1. Question Analysis</h4>
                      <p className="text-blue-700 text-sm">
                        Natural language processing identifies key business terms and intent
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-900">2. Metadata Mapping</h4>
                      <p className="text-green-700 text-sm">
                        Business concepts are mapped to database tables and columns
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-purple-900">3. SQL Generation</h4>
                      <p className="text-purple-700 text-sm">
                        Optimized SQL is generated with business rules applied
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-semibold text-orange-900">4. Context Addition</h4>
                      <p className="text-orange-700 text-sm">
                        Business context and assumptions are added for clarity
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Ask a question to see business context</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 