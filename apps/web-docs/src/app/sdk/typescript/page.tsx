'use client'

import { useState } from 'react'
import { CodeBlock } from '../../../components/ui/CodeBlock'
import { CommandLineIcon, CpuChipIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'



export default function TypeScriptSDKPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('installation')

  const sections = {
    installation: {
      title: 'Installation & Setup',
      icon: CommandLineIcon,
      content: `# Schlep Engine TypeScript/JavaScript SDK

## Installation

Install the Schlep Engine SDK using npm or yarn:

\`\`\`bash
# Using npm
npm install @schlep-engine/sdk

# Using yarn
yarn add @schlep-engine/sdk

# Using pnpm
pnpm add @schlep-engine/sdk
\`\`\`

## TypeScript Setup

For TypeScript projects, types are included:

\`\`\`typescript
import { SchlepEngine } from '@schlep-engine/sdk';
import type { 
  Pipeline, 
  TrainingConfig, 
  PredictionResult,
  EquipmentData 
} from '@schlep-engine/sdk/types';
\`\`\`

## Authentication

Set up your API credentials:

\`\`\`typescript
import { SchlepEngine } from '@schlep-engine/sdk';

// Method 1: Environment variable (recommended)
const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY
});

// Method 2: Direct instantiation
const client = new SchlepEngine({
  apiKey: 'your_api_key_here',
  baseUrl: 'https://api.schlep-engine.com', // optional
  timeout: 30000, // optional, default 30s
  retryAttempts: 3 // optional, default 3
});

// Method 3: Configuration object
const config = {
  apiKey: 'your_api_key',
  environment: 'production', // or 'staging', 'development'
  enableLogging: true,
  logLevel: 'info'
};

const client = new SchlepEngine(config);
\`\`\`

## Environment Configuration

Create a configuration file:

\`\`\`json
// schlep.config.json
{
  "environments": {
    "development": {
      "apiKey": "dev_key_here",
      "baseUrl": "https://dev-api.schlep-engine.com",
      "timeout": 60000
    },
    "production": {
      "apiKey": "prod_key_here", 
      "baseUrl": "https://api.schlep-engine.com",
      "timeout": 30000
    }
  },
  "defaultEnvironment": "development"
}
\`\`\`

\`\`\`typescript
import { SchlepEngine } from '@schlep-engine/sdk';
import config from './schlep.config.json';

const client = new SchlepEngine({
  ...config.environments[process.env.NODE_ENV || config.defaultEnvironment]
});
\`\`\`

## Basic Usage

\`\`\`typescript
import { SchlepEngine } from '@schlep-engine/sdk';

const client = new SchlepEngine({ apiKey: process.env.SCHLEP_API_KEY });

// Check API health
const health = await client.health();
console.log(\`API Status: \${health.status}\`);

// Get available modules
const modules = await client.getModules();
modules.forEach(module => {
  console.log(\`Module: \${module.name} - \${module.description}\`);
});
\`\`\`

## React Integration

\`\`\`typescript
// hooks/useSchlepEngine.ts
import { useEffect, useState } from 'react';
import { SchlepEngine } from '@schlep-engine/sdk';

export const useSchlepEngine = () => {
  const [client] = useState(() => new SchlepEngine({
    apiKey: process.env.NEXT_PUBLIC_SCHLEP_API_KEY
  }));
  
  return client;
};

// components/MLPipeline.tsx
import React, { useEffect, useState } from 'react';
import { useSchlepEngine } from '../hooks/useSchlepEngine';
import type { Pipeline } from '@schlep-engine/sdk/types';

export const MLPipeline: React.FC = () => {
  const client = useSchlepEngine();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  
  useEffect(() => {
    const loadPipelines = async () => {
      try {
        const result = await client.mlops.listPipelines();
        setPipelines(result.data);
      } catch (error) {
        console.error('Failed to load pipelines:', error);
      }
    };
    
    loadPipelines();
  }, [client]);
  
  return (
    <div>
      <h2>ML Pipelines</h2>
      {pipelines.map(pipeline => (
        <div key={pipeline.id}>
          <h3>{pipeline.name}</h3>
          <p>Status: {pipeline.status}</p>
        </div>
      ))}
    </div>
  );
};
\`\`\``
    },
    mlops: {
      title: 'MLOps Integration',
      icon: CpuChipIcon,
      content: `# MLOps Platform SDK

## Creating ML Pipelines

\`\`\`typescript
import { SchlepEngine } from '@schlep-engine/sdk';
import type { CreatePipelineRequest, TrainingConfig } from '@schlep-engine/sdk/types';

const client = new SchlepEngine({ apiKey: process.env.SCHLEP_API_KEY });

// Upload dataset
const dataset = new FormData();
dataset.append('file', csvFile);
dataset.append('name', 'sales_forecast_data');
dataset.append('description', 'Historical sales data');

const datasetInfo = await client.datasets.upload(dataset);

// Create ML pipeline
const pipelineRequest: CreatePipelineRequest = {
  name: 'sales_forecasting_pipeline',
  modelType: 'regression',
  dataSource: datasetInfo.datasetId,
  description: 'Sales forecasting with seasonal patterns'
};

const pipeline = await client.mlops.createPipeline(pipelineRequest);
console.log(\`Pipeline created: \${pipeline.pipelineId}\`);
\`\`\`

## Training Models

\`\`\`typescript
import type { TrainingConfig, TrainingJob } from '@schlep-engine/sdk/types';

// Configure training parameters
const trainingConfig: TrainingConfig = {
  targetColumn: 'sales_amount',
  featureColumns: ['month', 'region', 'product_category'],
  testSplit: 0.2,
  crossValidationFolds: 5,
  hyperparameterOptimization: true,
  algorithms: ['random_forest', 'xgboost', 'linear_regression']
};

// Start training
const trainingJob = await client.mlops.trainPipeline(
  pipeline.pipelineId, 
  trainingConfig
);

// Monitor training progress with polling
const monitorTraining = async (jobId: string): Promise<TrainingJob> => {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await client.mlops.getTrainingStatus(jobId);
        
        console.log(\`Training progress: \${status.progress || 0}%\`);
        
        if (status.status === 'completed') {
          clearInterval(pollInterval);
          resolve(status);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error(status.errorMessage));
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, 5000); // Poll every 5 seconds
  });
};

const completedJob = await monitorTraining(trainingJob.jobId);
console.log(\`Training completed with accuracy: \${completedJob.metrics?.accuracy}\`);
\`\`\`

## Making Predictions

\`\`\`typescript
import type { PredictionRequest, PredictionResult } from '@schlep-engine/sdk/types';

// Single prediction
const predictionData = {
  month: 3,
  region: 'north',
  product_category: 'electronics'
};

const prediction: PredictionResult = await client.mlops.predict(
  pipeline.pipelineId,
  predictionData
);

console.log(\`Predicted sales: $\${prediction.prediction.toFixed(2)}\`);
console.log(\`Confidence: \${(prediction.confidence * 100).toFixed(1)}%\`);

// Batch predictions
const batchData = [
  { month: 3, region: 'north', product_category: 'electronics' },
  { month: 3, region: 'south', product_category: 'clothing' },
  { month: 4, region: 'east', product_category: 'electronics' }
];

const batchPredictions = await client.mlops.predictBatch(
  pipeline.pipelineId,
  batchData
);

batchPredictions.predictions.forEach((pred, index) => {
  console.log(\`Sample \${index + 1}: $\${pred.prediction.toFixed(2)} (confidence: \${(pred.confidence * 100).toFixed(1)}%)\`);
});
\`\`\`

## Experiment Tracking

\`\`\`typescript
import type { Experiment, ExperimentParams, ExperimentMetrics } from '@schlep-engine/sdk/types';

// Create experiment
const experiment: Experiment = await client.experiments.create({
  name: 'sales_forecasting_v2',
  description: 'Improved forecasting with feature engineering',
  tags: ['sales', 'forecasting', 'v2']
});

// Log hyperparameters
const params: ExperimentParams = {
  learning_rate: 0.01,
  n_estimators: 100,
  max_depth: 8,
  feature_selection: 'recursive'
};

await client.experiments.logParams(experiment.experimentId, params);

// Log metrics during training
const logMetrics = async (epoch: number, trainLoss: number, valLoss: number) => {
  const metrics: ExperimentMetrics = {
    train_loss: trainLoss,
    val_loss: valLoss,
    epoch: epoch
  };
  
  await client.experiments.logMetrics(
    experiment.experimentId,
    epoch,
    metrics
  );
};

// Training loop with logging
for (let epoch = 0; epoch < 100; epoch++) {
  const trainLoss = performTrainingStep(); // Your training code
  const valLoss = performValidationStep();   // Your validation code
  
  await logMetrics(epoch, trainLoss, valLoss);
}

// Log artifacts
const modelFile = new File([modelBlob], 'model.pkl', { type: 'application/octet-stream' });
await client.experiments.logArtifact(
  experiment.experimentId,
  modelFile,
  'model'
);
\`\`\`

## Model Serving

\`\`\`typescript
import type { DeploymentConfig, Deployment, ServeRequest } from '@schlep-engine/sdk/types';

// Deploy model for serving
const deploymentConfig: DeploymentConfig = {
  instanceType: 't3.medium',
  minReplicas: 1,
  maxReplicas: 10,
  autoScaling: true,
  healthCheck: {
    path: '/health',
    intervalSeconds: 30
  }
};

const deployment: Deployment = await client.serving.deploy(
  completedJob.modelId,
  deploymentConfig
);

// Test deployed model
const serveRequest: ServeRequest = {
  data: {
    month: 5,
    region: 'west',
    product_category: 'home'
  }
};

const response = await client.serving.predict(
  deployment.deploymentId,
  serveRequest
);

console.log(\`Served prediction: $\${response.prediction.toFixed(2)}\`);

// A/B Testing
const abTestConfig = {
  name: 'model_comparison_v1_v2',
  variants: [
    { name: 'control', modelId: oldModelId, trafficPercent: 50 },
    { name: 'variant', modelId: newModelId, trafficPercent: 50 }
  ]
};

const abTest = await client.serving.createABTest(abTestConfig);
\`\`\``
    },
    manufacturing: {
      title: 'Manufacturing Integration',
      icon: CogIcon,
      content: `# Manufacturing SDK Integration

## IoT Data Collection

\`\`\`typescript
import { SchlepEngine } from '@schlep-engine/sdk';
import type { 
  IoTConnection, 
  OPCUAConfig, 
  SensorData,
  EquipmentAlert 
} from '@schlep-engine/sdk/types';

const client = new SchlepEngine({ apiKey: process.env.SCHLEP_API_KEY });

// Connect to OPC-UA server
const opcConfig: OPCUAConfig = {
  protocol: 'opc_ua',
  endpoint: 'opc.tcp://192.168.1.100:4840',
  equipmentId: 'cnc_mill_001',
  sensorMapping: [
    { nodeId: 'ns=2;s=Temperature', parameter: 'spindle_temp' },
    { nodeId: 'ns=2;s=Vibration', parameter: 'vibration' },
    { nodeId: 'ns=2;s=Power', parameter: 'power_consumption' }
  ]
};

const connection: IoTConnection = await client.iot.connectOPCUA(opcConfig);

// Real-time data streaming with WebSocket
const streamConfig = {
  equipmentId: 'cnc_mill_001',
  parameters: ['spindle_temp', 'vibration', 'power_consumption'],
  updateFrequency: '1s'
};

const stream = client.iot.createStream(streamConfig);

stream.on('data', (data: SensorData) => {
  console.log(\`Equipment: \${data.equipmentId}\`);
  console.log(\`Timestamp: \${data.timestamp}\`);
  console.log(\`Sensors:\`, data.sensorData);
  
  // Process data for analytics
  processSensorReading(data);
});

stream.on('error', (error: Error) => {
  console.error('IoT stream error:', error);
});

const processSensorReading = async (data: SensorData) => {
  // Check for anomalies
  if (data.sensorData.spindle_temp > 70) {
    await triggerAlert('Temperature alert', data);
  }
  
  // Store for historical analysis
  await storeHistoricalData(data);
};

// React component for real-time monitoring
import React, { useEffect, useState } from 'react';

export const EquipmentMonitor: React.FC<{ equipmentId: string }> = ({ equipmentId }) => {
  const client = useSchlepEngine();
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [alerts, setAlerts] = useState<EquipmentAlert[]>([]);
  
  useEffect(() => {
    const stream = client.iot.createStream({ equipmentId });
    
    stream.on('data', setSensorData);
    stream.on('alert', (alert: EquipmentAlert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    });
    
    return () => stream.disconnect();
  }, [client, equipmentId]);
  
  return (
    <div className="equipment-monitor">
      <h2>Equipment: {equipmentId}</h2>
      {sensorData && (
        <div>
          <p>Temperature: {sensorData.sensorData.spindle_temp}°C</p>
          <p>Vibration: {sensorData.sensorData.vibration} mm/s²</p>
          <p>Power: {sensorData.sensorData.power_consumption} kW</p>
        </div>
      )}
      
      {alerts.length > 0 && (
        <div className="alerts">
          <h3>Recent Alerts</h3>
          {alerts.map(alert => (
            <div key={alert.id} className="alert">
              <span>{alert.type}: {alert.message}</span>
              <time>{new Date(alert.timestamp).toLocaleString()}</time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
\`\`\`

## MES Integration

\`\`\`typescript
import type { 
  ProductionOrder, 
  ProductionOrderRequest,
  QualityCheck,
  ResourceUtilization 
} from '@schlep-engine/sdk/types';

// Create production order
const orderRequest: ProductionOrderRequest = {
  orderDetails: {
    productId: 'PART_ABC_001',
    quantity: 100,
    priority: 'high',
    dueDate: '2024-02-15T16:00:00Z'
  },
  resourceRequirements: [
    {
      resourceType: 'machine',
      resourceId: 'cnc_mill_001',
      durationMinutes: 240
    },
    {
      resourceType: 'operator',
      skillLevel: 'advanced',
      durationMinutes: 480
    }
  ]
};

const productionOrder: ProductionOrder = await client.mes.createProductionOrder(orderRequest);
console.log(\`Production order created: \${productionOrder.productionOrderId}\`);

// Monitor production status
const monitorProduction = async (orderId: string) => {
  const status = await client.mes.getProductionStatus(orderId, {
    includeMetrics: true
  });
  
  console.log(\`Order Status: \${status.status}\`);
  console.log(\`Progress: \${status.progressPercentage}%\`);
  console.log(\`OEE: \${status.performanceMetrics?.oee}\`);
  
  return status;
};

// Record quality check
const qualityData: QualityCheck = {
  inspectionData: {
    orderId: productionOrder.productionOrderId,
    operationStep: 'machining',
    inspectorId: 'QC_001',
    inspectionTimestamp: new Date().toISOString()
  },
  measurements: [
    {
      parameterName: 'diameter',
      measuredValue: 25.02,
      specificationMin: 24.95,
      specificationMax: 25.05,
      passFail: true
    }
  ]
};

const qualityResult = await client.mes.recordQualityCheck(qualityData);

// Get resource utilization
const utilization: ResourceUtilization = await client.mes.getResourceUtilization({
  timePeriod: 'day',
  resourceFilter: ['cnc_mill_001']
});
\`\`\`

## Digital Twin Operations

\`\`\`typescript
import type { 
  DigitalTwinConfig,
  DigitalTwin,
  TwinState,
  ScenarioTest,
  OptimizationResult 
} from '@schlep-engine/sdk/types';

// Create digital twin
const twinConfig: DigitalTwinConfig = {
  assetDetails: {
    assetId: 'cnc_mill_001',
    assetType: 'cnc_machine',
    manufacturer: 'Haas',
    model: 'VF-2SS'
  },
  twinConfiguration: {
    physicsModel: 'detailed',
    updateFrequency: '5s',
    simulationFidelity: 'high',
    predictiveHorizon: '24h'
  },
  sensorMapping: [
    {
      sensorId: 'TEMP_001',
      parameterType: 'spindle_temperature',
      mappingFunction: 'thermal_model_sync'
    }
  ]
};

const digitalTwin: DigitalTwin = await client.digitalTwin.create(twinConfig);
const twinId = digitalTwin.digitalTwinId;

// Get real-time twin state
const state: TwinState = await client.digitalTwin.getState(twinId, {
  includePredictions: true
});

console.log(\`Twin Status: \${state.syncStatus}\`);
console.log(\`Spindle Speed: \${state.currentState.spindleSpeedRpm} RPM\`);
console.log(\`Health Score: \${state.predictiveInsights?.healthScore}\`);

// Run scenario testing
const scenarioConfig = {
  scenarioConfig: {
    scenarioName: 'Increased Production Speed',
    testDuration: '8h',
    simulationSpeed: 100
  },
  testParameters: [
    {
      parameterName: 'spindle_speed_rpm',
      newValue: 3200,
      changeSchedule: 'immediate'
    }
  ]
};

const scenarioTest: ScenarioTest = await client.digitalTwin.runScenarioTest(
  twinId, 
  scenarioConfig
);

// Monitor scenario progress
const monitorScenario = async (testId: string): Promise<ScenarioTest> => {
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(async () => {
      try {
        const status = await client.digitalTwin.getScenarioStatus(twinId, testId);
        
        if (status.testStatus === 'completed') {
          clearInterval(checkInterval);
          resolve(status);
        } else if (status.testStatus === 'failed') {
          clearInterval(checkInterval);
          reject(new Error('Scenario test failed'));
        }
      } catch (error) {
        clearInterval(checkInterval);
        reject(error);
      }
    }, 10000); // Check every 10 seconds
  });
};

// Optimize parameters
const optimizationConfig = {
  optimizationConfig: {
    primaryObjective: 'maximize_throughput',
    optimizationHorizon: '24h',
    algorithm: 'genetic_algorithm'
  },
  constraints: [
    {
      parameterName: 'spindle_speed_rpm',
      minValue: 1000,
      maxValue: 4000,
      constraintType: 'hard_limit'
    }
  ]
};

const optimization: OptimizationResult = await client.digitalTwin.optimizeParameters(
  twinId, 
  optimizationConfig
);

optimization.recommendedParameters.forEach(param => {
  console.log(\`\${param.parameterName}: \${param.currentValue} → \${param.optimalValue}\`);
});
\`\`\`

## Analytics Integration

\`\`\`typescript
import type { 
  AnalyticsConfig,
  EquipmentForecast,
  SPCConfig,
  SPCSystem,
  AnalyticsResult 
} from '@schlep-engine/sdk/types';

// Configure predictive maintenance analytics
const analyticsConfig: AnalyticsConfig = {
  equipmentId: 'cnc_mill_001',
  analysisType: {
    predictiveMaintenance: true,
    anomalyDetection: true,
    qualityPrediction: true
  }
};

// Start real-time analysis
const analysisResult: AnalyticsResult = await client.analytics.streamAnalyze(analyticsConfig);
console.log(\`Analysis started: \${analysisResult.analysisId}\`);

// Get equipment forecasts
const forecasts: EquipmentForecast = await client.analytics.getEquipmentForecasts(
  'cnc_mill_001',
  { forecastHorizon: '30d' }
);

console.log('Failure Probability Forecast:');
forecasts.forecasts.failureProbability.forEach(point => {
  console.log(\`  \${point.date}: \${(point.probability * 100).toFixed(1)}%\`);
});

// Configure Statistical Process Control
const spcConfig: SPCConfig = {
  processId: 'machining_line_01',
  spcConfig: {
    controlLimits: {
      ucl: 45.2,
      lcl: 38.8,
      centerLine: 42.0
    },
    chartType: 'x_bar',
    sampleSize: 5,
    violationRules: [
      'point_beyond_limits',
      'seven_points_one_side'
    ]
  }
};

const spcSystem: SPCSystem = await client.analytics.configureSPC(spcConfig);
console.log(\`SPC configured: \${spcSystem.spcId}\`);

// React component for analytics dashboard
export const AnalyticsDashboard: React.FC<{ equipmentId: string }> = ({ equipmentId }) => {
  const client = useSchlepEngine();
  const [forecasts, setForecasts] = useState<EquipmentForecast | null>(null);
  const [spcStatus, setSpcStatus] = useState<SPCSystem | null>(null);
  
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [forecastData, spcData] = await Promise.all([
          client.analytics.getEquipmentForecasts(equipmentId),
          client.analytics.getSPCStatus(equipmentId)
        ]);
        
        setForecasts(forecastData);
        setSpcStatus(spcData);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      }
    };
    
    loadAnalytics();
  }, [client, equipmentId]);
  
  return (
    <div className="analytics-dashboard">
      <h2>Analytics Dashboard</h2>
      
      {forecasts && (
        <div>
          <h3>Failure Predictions</h3>
          {forecasts.forecasts.failureProbability.map((point, index) => (
            <div key={index}>
              {point.date}: {(point.probability * 100).toFixed(1)}% risk
            </div>
          ))}
        </div>
      )}
      
      {spcStatus && (
        <div>
          <h3>SPC Status</h3>
          <p>Status: {spcStatus.status}</p>
          <p>Active Violations: {spcStatus.activeViolations?.length || 0}</p>
        </div>
      )}
    </div>
  );
};
\`\`\``
    },
    advanced: {
      title: 'Advanced Features',
      icon: ChartBarIcon,
      content: `# Advanced SDK Features

## Error Handling

Comprehensive error handling with typed exceptions:

\`\`\`typescript
import { 
  SchlepEngine, 
  SchlepAPIError, 
  AuthenticationError,
  RateLimitError,
  ValidationError 
} from '@schlep-engine/sdk';

const client = new SchlepEngine({ apiKey: process.env.SCHLEP_API_KEY });

try {
  const result = await client.mlops.createPipeline(invalidConfig);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Configuration error:', error.message);
    console.log('Invalid fields:', error.details.invalidFields);
  } else if (error instanceof AuthenticationError) {
    console.log('Authentication failed:', error.message);
  } else if (error instanceof RateLimitError) {
    console.log(\`Rate limit exceeded. Retry after: \${error.retryAfter} seconds\`);
  } else if (error instanceof SchlepAPIError) {
    console.log(\`API error: \${error.message} (status: \${error.statusCode})\`);
  } else {
    console.log('Unexpected error:', error);
  }
}
\`\`\`

## Pagination and Filtering

Handle large datasets with automatic pagination:

\`\`\`typescript
import type { PaginatedResponse, ExperimentFilters } from '@schlep-engine/sdk/types';

// Automatic pagination with async iterator
const filters: ExperimentFilters = {
  status: 'completed',
  createdAfter: '2024-01-01',
  tags: ['production']
};

// Method 1: Async iterator (recommended)
for await (const experiment of client.experiments.listAll(filters)) {
  console.log(\`Experiment: \${experiment.name}\`);
}

// Method 2: Manual pagination
let page = 1;
let hasMore = true;

while (hasMore) {
  const response: PaginatedResponse<Experiment> = await client.experiments.list({
    ...filters,
    page,
    pageSize: 50
  });
  
  response.data.forEach(experiment => {
    console.log(\`Experiment: \${experiment.name}\`);
  });
  
  hasMore = response.hasNext;
  page++;
}

// Method 3: Collect all pages
const allExperiments = await client.experiments.listAll(filters).toArray();
\`\`\`

## Batch Operations

Efficient batch processing for large-scale operations:

\`\`\`typescript
import type { BatchPredictionRequest, BatchPredictionResult } from '@schlep-engine/sdk/types';

// Batch predictions with automatic chunking
const batchRequests: BatchPredictionRequest[] = Array.from({ length: 10000 }, (_, i) => ({
  data: { 
    feature1: Math.random() * 10, 
    feature2: Math.random() * 5 
  }
}));

// SDK automatically chunks large batches
const batchResult: BatchPredictionResult = await client.mlops.predictBatch(
  'pipeline_123',
  batchRequests,
  {
    chunkSize: 100, // Process in chunks of 100
    concurrency: 3  // Max 3 concurrent batches
  }
);

console.log(\`Processed \${batchResult.predictions.length} predictions\`);

// Progress tracking for large batches
const progressCallback = (progress: { completed: number; total: number }) => {
  const percent = (progress.completed / progress.total) * 100;
  console.log(\`Progress: \${percent.toFixed(1)}%\`);
};

const result = await client.mlops.predictBatch(
  'pipeline_123',
  batchRequests,
  { onProgress: progressCallback }
);
\`\`\`

## WebSocket Integration

Real-time data streaming with automatic reconnection:

\`\`\`typescript
import type { StreamConfig, StreamEvent } from '@schlep-engine/sdk/types';

// Equipment monitoring stream
const streamConfig: StreamConfig = {
  equipmentId: 'cnc_mill_001',
  parameters: ['temperature', 'vibration', 'power'],
  updateFrequency: '1s'
};

const stream = client.iot.createStream(streamConfig);

// Event handlers
stream.on('connected', () => {
  console.log('Stream connected');
});

stream.on('data', (data: StreamEvent) => {
  console.log('New data:', data);
});

stream.on('error', (error: Error) => {
  console.error('Stream error:', error);
});

stream.on('disconnected', () => {
  console.log('Stream disconnected');
});

// Automatic reconnection is handled internally
stream.connect();

// React hook for streaming data
import { useEffect, useState } from 'react';

export const useEquipmentStream = (equipmentId: string) => {
  const client = useSchlepEngine();
  const [data, setData] = useState<StreamEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const stream = client.iot.createStream({ equipmentId });
    
    stream.on('connected', () => setConnected(true));
    stream.on('disconnected', () => setConnected(false));
    stream.on('data', setData);
    stream.on('error', setError);
    
    stream.connect();
    
    return () => stream.disconnect();
  }, [client, equipmentId]);
  
  return { data, connected, error };
};
\`\`\`

## Webhooks Integration

Set up webhooks for event notifications:

\`\`\`typescript
import type { WebhookConfig, WebhookEvent } from '@schlep-engine/sdk/types';

// Configure webhook
const webhookConfig: WebhookConfig = {
  url: 'https://your-app.com/webhooks/schlep',
  events: [
    'pipeline.training.completed',
    'prediction.batch.completed',
    'equipment.alert.triggered'
  ],
  secret: 'your_webhook_secret'
};

const webhook = await client.webhooks.create(webhookConfig);

// Express.js webhook handler
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.raw({ type: 'application/json' }));

app.post('/webhooks/schlep', (req, res) => {
  const signature = req.headers['x-schlep-signature'] as string;
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).send('Invalid signature');
  }
  
  const event: WebhookEvent = JSON.parse(payload.toString());
  
  // Handle different event types
  switch (event.event) {
    case 'pipeline.training.completed':
      handleTrainingCompleted(event.data);
      break;
    case 'equipment.alert.triggered':
      handleEquipmentAlert(event.data);
      break;
    default:
      console.log('Unknown event:', event.event);
  }
  
  res.status(200).send('OK');
});

// Next.js API route handler
// pages/api/webhooks/schlep.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '@schlep-engine/sdk/webhook';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const signature = req.headers['x-schlep-signature'] as string;
  const isValid = verifyWebhookSignature(req.body, signature, process.env.WEBHOOK_SECRET!);
  
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid signature' });
  }
  
  const event: WebhookEvent = req.body;
  
  // Process webhook event
  processWebhookEvent(event);
  
  res.status(200).json({ message: 'OK' });
}
\`\`\`

## Custom Middleware and Interceptors

Extend SDK functionality with middleware:

\`\`\`typescript
import type { RequestInterceptor, ResponseInterceptor } from '@schlep-engine/sdk/types';

// Request interceptor for adding custom headers
const authInterceptor: RequestInterceptor = (config) => {
  const token = getCustomAuthToken();
  config.headers['X-Custom-Auth'] = token;
  return config;
};

// Response interceptor for custom error handling
const errorInterceptor: ResponseInterceptor = (response) => {
  if (response.status >= 400) {
    // Custom error logging
    logError(response);
  }
  return response;
};

// Create client with interceptors
const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY,
  requestInterceptors: [authInterceptor],
  responseInterceptors: [errorInterceptor]
});

// Retry middleware for transient failures
const retryInterceptor: RequestInterceptor = (config) => {
  config.retries = 3;
  config.retryDelay = (attempt) => Math.pow(2, attempt) * 1000; // Exponential backoff
  config.retryCondition = (error) => {
    return error.status >= 500 || error.code === 'NETWORK_ERROR';
  };
  return config;
};
\`\`\`

## TypeScript Configuration

Optimize TypeScript usage:

\`\`\`typescript
// types/schlep.d.ts - Extend SDK types
declare module '@schlep-engine/sdk' {
  interface CustomMetrics {
    customAccuracy: number;
    domainSpecificMetric: number;
  }
  
  interface TrainingMetrics extends CustomMetrics {}
}

// Utility types for better type safety
import type { Pipeline } from '@schlep-engine/sdk/types';

type CompletedPipeline = Pipeline & { status: 'completed' };
type TrainingPipeline = Pipeline & { status: 'training' };

const processCompletedPipeline = (pipeline: CompletedPipeline) => {
  // TypeScript knows this pipeline is completed
  console.log(\`Model accuracy: \${pipeline.metrics.accuracy}\`);
};

// Generic helpers
const createTypedClient = <T extends Record<string, any>>(
  apiKey: string,
  customConfig?: T
) => {
  return new SchlepEngine({
    apiKey,
    ...customConfig
  });
};

// Environment-specific types
type Environment = 'development' | 'staging' | 'production';

const getClientForEnvironment = (env: Environment) => {
  const configs = {
    development: { timeout: 60000, retries: 1 },
    staging: { timeout: 30000, retries: 2 },
    production: { timeout: 15000, retries: 3 }
  };
  
  return createTypedClient(
    process.env[\`SCHLEP_\${env.toUpperCase()}_API_KEY\`]!,
    configs[env]
  );
};
\`\`\``
    }
  }

  type SectionKey = keyof typeof sections;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">TypeScript/JavaScript SDK</h1>
        <p className="text-gray-600 text-lg">
          Modern TypeScript SDK with full type safety, React integration, and WebSocket support 
          for building production-ready applications with Schlep Engine.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {Object.entries(sections).map(([key, section]) => {
          const Icon = section.icon
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeSection === key
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{section.title}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6">
          <CodeBlock
            code={sections[activeSection as SectionKey].content}
            language="typescript"
            title={sections[activeSection as SectionKey].title}
          />
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quick Start Example</h2>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <CodeBlock
            code={`// Install and quick start
npm install @schlep-engine/sdk

// Simple MLOps example
import { SchlepEngine } from '@schlep-engine/sdk';

const client = new SchlepEngine({ 
  apiKey: process.env.SCHLEP_API_KEY 
});

// Create and train a model
const dataset = await client.datasets.upload(csvFile);
const pipeline = await client.mlops.createPipeline({
  name: 'my_model',
  modelType: 'regression',
  dataSource: dataset.datasetId
});

await client.mlops.trainPipeline(pipeline.pipelineId, {
  targetColumn: 'sales'
});

// Make predictions
const result = await client.mlops.predict(pipeline.pipelineId, {
  feature1: 1.0,
  feature2: 2.0
});

console.log(\`Prediction: \${result.prediction}\`);`}
            language="typescript"
          />
        </div>
      </div>

      {/* Framework Integrations */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">React Integration</h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Custom React hooks for data fetching
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Real-time WebSocket integration
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Context providers for global state
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Suspense-compatible async components
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              TypeScript prop validation
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Node.js Features</h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-3"></span>
              Express.js middleware integration
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-3"></span>
              Next.js API route handlers
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-3"></span>
              Webhook signature verification
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-3"></span>
              Stream processing utilities
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-3"></span>
              Environment-based configuration
            </li>
          </ul>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Additional Resources</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">NPM Package</h3>
            <p className="text-gray-600 text-sm mb-4">
              Install from NPM with TypeScript definitions included
            </p>
            <a 
              href="https://www.npmjs.com/package/@schlep-engine/sdk" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on NPM →
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Examples Repository</h3>
            <p className="text-gray-600 text-sm mb-4">
              Complete examples for React, Next.js, and Node.js
            </p>
            <a 
              href="https://github.com/schlep-engine/sdk-examples" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Examples →
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">TypeScript Reference</h3>
            <p className="text-gray-600 text-sm mb-4">
              Complete type definitions and API reference
            </p>
            <a 
              href="https://sdk-docs.schlep-engine.com/typescript" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Browse Types →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}