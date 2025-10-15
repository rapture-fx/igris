export interface LabelingProject {
  id: string;
  name: string;
  type: string;
  items_labeled: number;
  total_items: number;
  progress: number;
  quality_score: number;
  team_size: number;
  auto_label_enabled: boolean;
  created_at: string;
  updated_at: string;
  labels: string[];
}

export interface QueueItem {
  id: string;
  data: any;
  auto_label_suggestion?: string;
}
