export interface LabelingRule {
  id: string;
  name: string;
  description: string;
  label: string;
  criteria: string; // Could be a more complex object in a real app
  isActive: boolean;
  coverage: number; // 0 to 1
  createdAt: string;
}

export interface RuleStats {
  total: number;
  active: number;
} 