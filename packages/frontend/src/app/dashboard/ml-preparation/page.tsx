'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  Upload, 
  Zap, 
  Target, 
  CheckCircle2, 
  Clock, 
  Database,
  Cpu,
  BarChart3,
  Settings,
  Download,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  FileText,
  Eye,
  TrendingUp,
  Shield,
  Star,
  Layers,
  GitBranch,
  CheckSquare,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Pipeline {
  pipeline_id: string;
  name: string;
  description?: string;
  current_stage: string;
  progress_percentage: number;
  quality_score?: number;
  quality_level?: string;
  is_ml_ready: boolean;
  target_frameworks: string[];
  total_records?: number;
  total_columns?: number;
  processing_time_seconds?: number;
  created_at: string;
  completed_at?: string;
}

interface FrameworkConfig {
  name: string;
  key: string;
  description: string;
  icon: string;
  supported_formats: string[];
  use_cases: string[];
}

// Mock data for demonstration
const mockPipelines: Pipeline[] = [
  {
    pipeline_id: '1',
    name: 'Customer Data ML Prep',
    description: 'Preparing customer dataset for predictive analytics',
    current_stage: 'validation',
    progress_percentage: 85,
    quality_score: 0.92,
    quality_level: 'excellent',
    is_ml_ready: false,
    target_frameworks: ['tensorflow', 'pytorch', 'sklearn'],
    total_records: 150000,
    total_columns: 23,
    processing_time_seconds: 120,
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    pipeline_id: '2',
    name: 'Sales Forecast Preparation',
    description: 'Time series data prep for forecasting models',
    current_stage: 'completed',
    progress_percentage: 100,
    quality_score: 0.88,
    quality_level: 'good',
    is_ml_ready: true,
    target_frameworks: ['tensorflow', 'xgboost'],
    total_records: 500000,
    total_columns: 15,
    processing_time_seconds: 180,
    created_at: '2024-01-14T14:20:00Z',
    completed_at: '2024-01-14T14:23:00Z'
  }
];

const supportedFrameworks: FrameworkConfig[] = [
  {
    name: 'TensorFlow',
    key: 'tensorflow',
    description: 'Google\'s production-ready ML framework',
    icon: '🔥',
    supported_formats: ['tf.data.Dataset', 'SavedModel'],
    use_cases: ['Deep Learning', 'Production ML', 'Large-scale Training']
  },
  {
    name: 'PyTorch',
    key: 'pytorch',
    description: 'Research-focused neural network framework',
    icon: '⚡',
    supported_formats: ['DataLoader', 'TensorDataset'],
    use_cases: ['Research', 'Computer Vision', 'NLP']
  },
  {
    name: 'scikit-learn',
    key: 'sklearn',
    description: 'Classical machine learning library',
    icon: '🎯',
    supported_formats: ['numpy arrays', 'pandas DataFrame'],
    use_cases: ['Traditional ML', 'Data Science', 'Quick Prototyping']
  },
  {
    name: 'Hugging Face',
    key: 'huggingface',
    description: 'Transformers and NLP model hub',
    icon: '🤗',
    supported_formats: ['datasets.Dataset', 'transformers compatible'],
    use_cases: ['NLP', 'Transformers', 'Pre-trained Models']
  },
  {
    name: 'XGBoost',
    key: 'xgboost',
    description: 'Gradient boosting for structured data',
    icon: '🚀',
    supported_formats: ['DMatrix', 'numpy arrays'],
    use_cases: ['Tabular Data', 'Competitions', 'Feature Engineering']
  }
];

// Quality level colors
const qualityColors = {
  excellent: 'bg-green-100 text-green-800 border-green-200',
  good: 'bg-blue-100 text-blue-800 border-blue-200',
  fair: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  poor: 'bg-red-100 text-red-800 border-red-200'
};

// Stage colors
const stageColors = {
  ingestion: 'bg-gray-100 text-gray-800',
  profiling: 'bg-blue-100 text-blue-800',
  cleaning: 'bg-orange-100 text-orange-800',
  transformation: 'bg-purple-100 text-purple-800',
  labeling: 'bg-indigo-100 text-indigo-800',
  validation: 'bg-yellow-100 text-yellow-800',
  export: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800'
};

export default function MLPreparationPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [pipelines, setPipelines] = useState<Pipeline[]>(mockPipelines);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Pipeline configuration state
  const [pipelineConfig, setPipelineConfig] = useState({
    name: '',
    description: '',
    target_frameworks: ['tensorflow', 'sklearn'],
    quality_threshold: 0.8,
    enable_auto_labeling: true,
    enable_feature_engineering: true,
    train_test_split_ratio: 0.8,
    validation_split_ratio: 0.1,
    remove_duplicates: true,
    handle_missing_values: true,
    normalize_data: true,
    detect_outliers: true,
    confidence_threshold: 0.9
  });

  // File upload handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setPipelineConfig(prev => ({
        ...prev,
        name: prev.name || `ML Prep - ${file.name.split('.')[0]}`
      }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    maxSize: 1024 * 1024 * 1024 // 1GB
  });

  const createPipeline = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a file first');
      return;
    }

    setIsCreatingPipeline(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newPipeline: Pipeline = {
        pipeline_id: Date.now().toString(),
        name: pipelineConfig.name,
        description: pipelineConfig.description,
        current_stage: 'ingestion',
        progress_percentage: 0,
        is_ml_ready: false,
        target_frameworks: pipelineConfig.target_frameworks,
        created_at: new Date().toISOString()
      };

      setPipelines(prev => [newPipeline, ...prev]);
      setSelectedPipeline(newPipeline);
      setActiveTab('pipelines');
      toast.success('Pipeline created successfully!');
      
      // Start pipeline execution
      executePipeline(newPipeline.pipeline_id);
      
    } catch (error) {
      toast.error('Failed to create pipeline');
    } finally {
      setIsCreatingPipeline(false);
    }
  };

  const executePipeline = async (pipelineId: string) => {
    // Simulate pipeline execution with progress updates
    const pipeline = pipelines.find(p => p.pipeline_id === pipelineId);
    if (!pipeline) return;

    const stages = ['ingestion', 'profiling', 'cleaning', 'transformation', 'labeling', 'validation', 'export', 'completed'];
    const stageProgress = [10, 20, 40, 60, 75, 85, 95, 100];

    for (let i = 0; i < stages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPipelines(prev => prev.map(p => 
        p.pipeline_id === pipelineId 
          ? { 
              ...p, 
              current_stage: stages[i],
              progress_percentage: stageProgress[i],
              quality_score: i >= 6 ? 0.85 + Math.random() * 0.1 : undefined,
              quality_level: i >= 6 ? 'good' : undefined,
              is_ml_ready: i === stages.length - 1,
              completed_at: i === stages.length - 1 ? new Date().toISOString() : undefined
            }
          : p
      ));
    }
    
    toast.success('Pipeline execution completed!');
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'ingestion': return <Database className="w-4 h-4" />;
      case 'profiling': return <BarChart3 className="w-4 h-4" />;
      case 'cleaning': return <RefreshCw className="w-4 h-4" />;
      case 'transformation': return <Settings className="w-4 h-4" />;
      case 'labeling': return <Target className="w-4 h-4" />;
      case 'validation': return <CheckSquare className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ML Data Preparation"
        description="Infrastructure for AI companies data preparation engine that transforms raw datasets into ML-ready formats"
        stats={[
          {
            label: 'Active Pipelines',
            value: pipelines.filter(p => !p.is_ml_ready).length,
            icon: Activity,
            color: 'blue'
          },
          {
            label: 'ML-Ready Datasets',
            value: pipelines.filter(p => p.is_ml_ready).length,
            icon: CheckCircle2,
            color: 'green'
          },
          {
            label: 'Avg Quality Score',
            value: `${Math.round((pipelines.filter(p => p.quality_score).reduce((acc, p) => acc + (p.quality_score || 0), 0) / pipelines.filter(p => p.quality_score).length || 0) * 100)}%`,
            icon: Star,
            color: 'purple'
          }
        ]}
        actions={
          <Button 
            onClick={() => setActiveTab('create')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            New ML Pipeline
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Create Pipeline
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Pipelines
          </TabsTrigger>
          <TabsTrigger value="frameworks" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Frameworks
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Benefits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Zap className="w-5 h-5" />
                  Speed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700">
                  Reduces data prep time from <strong>weeks to hours</strong> with intelligent automation
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="text-2xl font-bold text-blue-800">80%</div>
                  <div className="text-xs text-blue-600">time saved</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Target className="w-5 h-5" />
                  Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-green-700">
                  AI-driven anomaly detection catches issues <strong>human reviewers miss</strong>
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="text-2xl font-bold text-green-800">95%</div>
                  <div className="text-xs text-green-600">accuracy rate</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <Brain className="w-5 h-5" />
                  Learning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-purple-700">
                  Gets smarter with each dataset, building <strong>institutional knowledge</strong>
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="text-2xl font-bold text-purple-800">∞</div>
                  <div className="text-xs text-purple-600">continuous improvement</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Process Flow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                ML Preparation Process
              </CardTitle>
              <CardDescription>
                Automated 7-stage pipeline that transforms raw data into ML-ready format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {[
                  { stage: 'ingestion', title: 'Data Ingestion', desc: 'Load & validate' },
                  { stage: 'profiling', title: 'Smart Profiling', desc: 'Analyze patterns' },
                  { stage: 'cleaning', title: 'Auto Cleaning', desc: 'Fix issues' },
                  { stage: 'transformation', title: 'Transformation', desc: 'Feature engineering' },
                  { stage: 'labeling', title: 'Auto Labeling', desc: 'Unsupervised learning' },
                  { stage: 'validation', title: 'Quality Check', desc: 'ML readiness' },
                  { stage: 'export', title: 'Framework Export', desc: 'Ready for training' }
                ].map((item, index) => (
                  <div key={item.stage} className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${stageColors[item.stage as keyof typeof stageColors]}`}>
                      {getStageIcon(item.stage)}
                    </div>
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    {index < 6 && (
                      <ArrowRight className="w-4 h-4 text-gray-400 mx-auto mt-2 hidden md:block" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Pipelines */}
          {pipelines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Pipelines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pipelines.slice(0, 3).map((pipeline) => (
                    <div key={pipeline.pipeline_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stageColors[pipeline.current_stage as keyof typeof stageColors]}`}>
                          {getStageIcon(pipeline.current_stage)}
                        </div>
                        <div>
                          <div className="font-medium">{pipeline.name}</div>
                          <div className="text-sm text-gray-500 capitalize">{pipeline.current_stage.replace('_', ' ')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {pipeline.quality_score && (
                          <Badge variant="outline" className={qualityColors[pipeline.quality_level as keyof typeof qualityColors]}>
                            {Math.round(pipeline.quality_score * 100)}% Quality
                          </Badge>
                        )}
                        <Progress value={pipeline.progress_percentage} className="w-20" />
                        <span className="text-sm text-gray-500">{pipeline.progress_percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Create Pipeline Tab */}
        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create ML Preparation Pipeline</CardTitle>
              <CardDescription>
                Upload your dataset and configure automated ML preparation workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                {uploadedFile ? (
                  <div>
                    <p className="text-lg font-medium text-green-600">File uploaded: {uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">Size: {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium">Drop your dataset here or click to browse</p>
                    <p className="text-sm text-gray-500">Supports CSV, JSON, Excel files up to 1GB</p>
                  </div>
                )}
              </div>

              {/* Pipeline Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Pipeline Name</Label>
                    <Input
                      id="name"
                      value={pipelineConfig.name}
                      onChange={(e) => setPipelineConfig(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My ML Pipeline"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      value={pipelineConfig.description}
                      onChange={(e) => setPipelineConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your pipeline..."
                    />
                  </div>

                  <div>
                    <Label>Target ML Frameworks</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {supportedFrameworks.map((framework) => (
                        <div key={framework.key} className="flex items-center space-x-2">
                          <Switch
                            id={framework.key}
                            checked={pipelineConfig.target_frameworks.includes(framework.key)}
                            onCheckedChange={(checked) => {
                              setPipelineConfig(prev => ({
                                ...prev,
                                target_frameworks: checked
                                  ? [...prev.target_frameworks, framework.key]
                                  : prev.target_frameworks.filter(f => f !== framework.key)
                              }));
                            }}
                          />
                          <Label htmlFor={framework.key} className="text-sm">
                            {framework.icon} {framework.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Quality Threshold: {Math.round(pipelineConfig.quality_threshold * 100)}%</Label>
                    <input
                      type="range"
                      min="0.5"
                      max="1"
                      step="0.05"
                      value={pipelineConfig.quality_threshold}
                      onChange={(e) => setPipelineConfig(prev => ({ ...prev, quality_threshold: parseFloat(e.target.value) }))}
                      className="w-full mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-labeling">Auto Labeling</Label>
                      <Switch
                        id="auto-labeling"
                        checked={pipelineConfig.enable_auto_labeling}
                        onCheckedChange={(checked) => setPipelineConfig(prev => ({ ...prev, enable_auto_labeling: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="feature-engineering">Feature Engineering</Label>
                      <Switch
                        id="feature-engineering"
                        checked={pipelineConfig.enable_feature_engineering}
                        onCheckedChange={(checked) => setPipelineConfig(prev => ({ ...prev, enable_feature_engineering: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="remove-duplicates">Remove Duplicates</Label>
                      <Switch
                        id="remove-duplicates"
                        checked={pipelineConfig.remove_duplicates}
                        onCheckedChange={(checked) => setPipelineConfig(prev => ({ ...prev, remove_duplicates: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="handle-missing">Handle Missing Values</Label>
                      <Switch
                        id="handle-missing"
                        checked={pipelineConfig.handle_missing_values}
                        onCheckedChange={(checked) => setPipelineConfig(prev => ({ ...prev, handle_missing_values: checked }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={createPipeline}
                disabled={!uploadedFile || isCreatingPipeline}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                {isCreatingPipeline ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating Pipeline...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create ML Pipeline
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines" className="space-y-4">
          {pipelines.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No pipelines yet</h3>
                <p className="text-gray-600 mb-4">Create your first ML preparation pipeline to get started</p>
                <Button onClick={() => setActiveTab('create')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Create Pipeline
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pipelines.map((pipeline) => (
                <Card key={pipeline.pipeline_id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{pipeline.name}</h3>
                          <Badge variant="outline" className={stageColors[pipeline.current_stage as keyof typeof stageColors]}>
                            {getStageIcon(pipeline.current_stage)}
                            <span className="ml-1 capitalize">{pipeline.current_stage.replace('_', ' ')}</span>
                          </Badge>
                          {pipeline.is_ml_ready && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              ML Ready
                            </Badge>
                          )}
                        </div>
                        
                        {pipeline.description && (
                          <p className="text-gray-600 text-sm mb-3">{pipeline.description}</p>
                        )}

                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          {pipeline.total_records && (
                            <span className="flex items-center gap-1">
                              <Database className="w-4 h-4" />
                              {pipeline.total_records.toLocaleString()} records
                            </span>
                          )}
                          {pipeline.total_columns && (
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-4 h-4" />
                              {pipeline.total_columns} columns
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(pipeline.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <div className="text-xs text-gray-500">Frameworks:</div>
                          {pipeline.target_frameworks.map(framework => (
                            <Badge key={framework} variant="outline" className="text-xs">
                              {supportedFrameworks.find(f => f.key === framework)?.icon} {framework}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        {pipeline.quality_score && (
                          <div className="mb-2">
                            <Badge variant="outline" className={qualityColors[pipeline.quality_level as keyof typeof qualityColors]}>
                              <Star className="w-3 h-3 mr-1" />
                              {Math.round(pipeline.quality_score * 100)}% Quality
                            </Badge>
                          </div>
                        )}
                        
                        <div className="mb-2">
                          <Progress value={pipeline.progress_percentage} className="w-24" />
                          <div className="text-xs text-gray-500 mt-1">{pipeline.progress_percentage}% complete</div>
                        </div>

                        {pipeline.is_ml_ready ? (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <Download className="w-4 h-4 mr-1" />
                            Export
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Frameworks Tab */}
        <TabsContent value="frameworks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supportedFrameworks.map((framework) => (
              <Card key={framework.key} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{framework.icon}</div>
                    <div>
                      <CardTitle className="text-lg">{framework.name}</CardTitle>
                      <CardDescription className="text-sm">{framework.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Supported Formats</h4>
                    <div className="space-y-1">
                      {framework.supported_formats.map(format => (
                        <Badge key={format} variant="outline" className="text-xs mr-1 mb-1">
                          {format}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Use Cases</h4>
                    <div className="space-y-1">
                      {framework.use_cases.map(useCase => (
                        <div key={useCase} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          {useCase}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    View Documentation
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 