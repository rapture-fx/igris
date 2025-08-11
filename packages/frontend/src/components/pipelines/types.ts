export interface Pipeline {
  id: string;
  name: string;
  description: string;
  sourceType: string;
  destinationType: string;
  status: 'active' | 'inactive' | 'error';
  lastRun: string;
  runCount: number;
  successCount: number;
  errorCount: number;
}

export interface PipelineStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
} 