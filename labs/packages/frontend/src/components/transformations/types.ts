export interface Dataset {
  id: string
  name: string
  rowCount: number
  status: string
}

export interface TransformationStep {
  id: string
  type: string
  column: string
  description: string
  params: Record<string, any>
}

export interface Pipeline {
  id: string
  name: string
  description?: string
  dataset_id: string
  status: string
  steps: TransformationStep[]
  created_at: string
  target_framework?: string
} 