
import { Investigation } from '@/lib/api-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { DataAnalysisTabs } from './data-analysis-tabs'

interface AnalysisDetailsProps {
  investigation?: Investigation
  analysisData: Investigation | null
}

const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900 dark:text-gray-100">{value}</dd>
  </div>
)

export function AnalysisDetails({ investigation, analysisData }: AnalysisDetailsProps) {
  const displayData = analysisData || investigation

  if (!displayData) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex flex-col items-center justify-center text-center text-gray-500">
          <p className="text-lg font-semibold">Select an Investigation</p>
          <p>Choose an investigation from the list to see its details.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{displayData.name}</CardTitle>
                <p className="text-sm text-gray-500">{displayData.description || 'No description'}</p>
            </div>
            <Badge variant={
                displayData.status === 'completed' ? 'default' :
                displayData.status === 'failed' ? 'destructive' :
                'secondary'
            }>
                {displayData.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div>
                <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{displayData.progress_percentage}%</span>
                </div>
                <Progress value={displayData.progress_percentage} />
            </div>

            <dl className="space-y-2">
                <DetailRow label="Quality Score" value={displayData.quality_score || 'N/A'} />
                <DetailRow label="Total Records" value={displayData.total_records?.toLocaleString() || 'N/A'} />
                <DetailRow label="File Size" value={displayData.file_size_bytes ? `${(displayData.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'} />
                <DetailRow label="File Name" value={displayData.data_source_config?.filename || 'N/A'} />
                <DetailRow label="File Type" value={displayData.data_source_config?.file_type || 'N/A'} />
                <DetailRow label="Created" value={new Date(displayData.created_at).toLocaleString()} />
                <DetailRow label="Last Updated" value={new Date(displayData.updated_at).toLocaleString()} />
            </dl>
            
            <DataAnalysisTabs analysisData={displayData} />

        </div>
      </CardContent>
    </Card>
  )
} 