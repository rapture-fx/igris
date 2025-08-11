'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// This is a placeholder component. The actual component is defined inside
// packages/frontend/src/app/dashboard/data-sources/page.tsx
export function DataSourceCard({ source }: { source: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{source.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Type: {source.type}</p>
        <p>Status: {source.status}</p>
      </CardContent>
    </Card>
  )
} 