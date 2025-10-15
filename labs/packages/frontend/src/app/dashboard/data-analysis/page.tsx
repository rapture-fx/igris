'use client'

import { useState } from 'react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { DataAnalysisTabs } from '@/components/data-analysis/data-analysis-tabs'
import { InvestigationList } from '@/components/data-analysis/investigation-list'
import { AnalysisDetails } from '@/components/data-analysis/analysis-details'
import { useInvestigations, useInvestigation } from '@/hooks/useAPIData'
import { 
  BarChart3, 
  Search, 
  Filter,
  RefreshCw,
  Plus
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function DataAnalysisPage() {
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: investigations, loading: isLoadingInvestigations } = useInvestigations()
  const { data: analysisData } = useInvestigation(selectedInvestigationId)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // await investigations.refetch()
    setIsRefreshing(false)
  }

  const selectedInvestigation = (investigations as any[] || []).find(inv => inv.id === selectedInvestigationId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Analysis & Investigations"
        description="Explore datasets, run analyses, and manage investigations to uncover insights."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Data Analysis' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Refresh 
              onClick={handleRefresh}
              isLoading={isRefreshing}
            />
            <PageHeaderActions.Primary
              icon={Plus}
              onClick={() => {}}
            >
              New Investigation
            </PageHeaderActions.Primary>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                  placeholder="Search investigations..."
                className="pl-9"
                />
              </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
                  </div>
          <InvestigationList 
            investigations={(investigations as any[]) || []}
            selectedId={selectedInvestigationId}
            onSelect={setSelectedInvestigationId}
            isLoading={isLoadingInvestigations}
          />
        </div>

        <div className="lg:col-span-2">
          <AnalysisDetails 
            investigation={selectedInvestigation}
            analysisData={analysisData}
                      />
        </div>
      </div>
    </div>
  )
} 