
import { Investigation } from '@/lib/api-service'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DataAnalysisTabsProps {
  analysisData: Investigation
}

export function DataAnalysisTabs({ analysisData }: DataAnalysisTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
        <TabsTrigger value="schema">Schema</TabsTrigger>
        <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle>Investigation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p>A high-level summary of the investigation.</p>
            {/* More details can be added here */}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="data-quality">
        <Card>
          <CardHeader>
            <CardTitle>Data Quality Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Detailed data quality metrics and scores.</p>
            {/* Data quality components would go here */}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="schema">
        <Card>
          <CardHeader>
            <CardTitle>Inferred Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The detected schema of the dataset.</p>
            {/* Schema view component would go here */}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="anomalies">
        <Card>
          <CardHeader>
            <CardTitle>Anomalies Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <p>A list of anomalies found in the data.</p>
            {/* Anomalies list component would go here */}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
} 