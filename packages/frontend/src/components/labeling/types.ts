export interface LabelingProject {
    id: string
    name: string
    type: 'image_classification' | 'text_categorization' | 'object_detection'
    items_labeled: number
    total_items: number
    progress: number
    quality_score: number
    team_size: number
    auto_label_enabled: boolean
    created_at: string
    updated_at: string
    labels: string[]
  }
  
  export interface QueueItem {
    id: string
    data: string
    type: 'image' | 'text'
    status: 'pending' | 'labeled' | 'auto_labeled'
    auto_label_suggestion?: {
      label: string
      confidence: number
      model_used: string
    }
    metadata?: Record<string, any>
  } 