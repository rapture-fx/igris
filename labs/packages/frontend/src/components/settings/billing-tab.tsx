'use client'

import { 
  CreditCard,
  Crown,
  Download,
  CheckCircle
} from 'lucide-react'
import { useBilling } from '@/hooks/useAPIData'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function BillingTab() {
  const { data: billingInfo, loading } = useBilling()

  const renderSubscriptionSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div>
          <Skeleton className="h-8 w-1/4 mx-auto mb-2" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
        <div>
          <Skeleton className="h-8 w-1/4 mx-auto mb-2" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
        <div>
          <Skeleton className="h-8 w-1/4 mx-auto mb-2" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      </div>
    </div>
  )

  const renderPaymentSkeleton = () => <Skeleton className="h-10 w-full" />

  const renderHistorySkeleton = () => (
    [...Array(3)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      </TableRow>
    ))
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>
              {loading ? <Skeleton className="h-4 w-48 mt-1" /> : `You are on the ${billingInfo?.subscription.plan_name} plan.`}
            </CardDescription>
          </div>
          <Button>
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Plan
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? renderSubscriptionSkeleton() : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-3xl font-bold text-gray-800">{billingInfo?.subscription.usage.toLocaleString()}</p>
                <p className="text-sm text-gray-500">API Credits Used</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">${billingInfo?.subscription.cost_mtd.toFixed(2)}</p>
                <p className="text-sm text-gray-500">Cost Month-to-Date</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{new Date(billingInfo?.subscription.renews_on || '').toLocaleDateString()}</p>
                <p className="text-sm text-gray-500">Next Renewal Date</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>The primary payment method for your subscription.</CardDescription>
          </div>
          <Button variant="outline">Update Payment</Button>
        </CardHeader>
        <CardContent>
          {loading ? renderPaymentSkeleton() : (
            <div className="flex items-center space-x-4 p-4 border rounded-lg">
              <CreditCard className="h-8 w-8 text-gray-400" />
              <div>
                <p className="font-medium">{billingInfo?.paymentMethod.type} ending in {billingInfo?.paymentMethod.last4}</p>
                <p className="text-sm text-gray-500">Expires {billingInfo?.paymentMethod.expires}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Review and download your past invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? renderHistorySkeleton() : (
                billingInfo?.billingHistory.map((invoice: any) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" /> Paid
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 