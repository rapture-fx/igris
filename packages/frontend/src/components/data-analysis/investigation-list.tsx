
import { Investigation } from '@/lib/api-service'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { FileText, Clock, CheckCircle, XCircle, Zap } from 'lucide-react'

interface InvestigationListProps {
  investigations: Investigation[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  isLoading: boolean
}

const StatusIcon = ({ status }: { status: Investigation['status'] }) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />
    case 'processing':
      return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />
    default:
      return <FileText className="w-4 h-4 text-gray-400" />
  }
}

export function InvestigationList({
  investigations,
  selectedId,
  onSelect,
  isLoading,
}: InvestigationListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (investigations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No investigations found.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-2">
        <div className="space-y-2">
          {investigations.map(inv => (
            <button
              key={inv.id}
              onClick={() => onSelect(inv.id)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                selectedId === inv.id && 'bg-gray-200 dark:bg-gray-700'
              )}
            >
              <div className="flex justify-between items-center">
                <p className="font-semibold truncate flex-1">{inv.name}</p>
                <StatusIcon status={inv.status} />
              </div>
              <p className="text-sm text-gray-500 truncate">
                {inv.data_source_config?.filename || 'Untitled'}
              </p>
               <div className="text-xs text-gray-400 mt-1">
                {new Date(inv.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 