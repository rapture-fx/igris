/**
 * Basic usage example for Igris-engine JavaScript SDK
 */

import { 
  IgrisClient, 
  DataFormat, 
  ProcessingMode,
  MLTaskType,
  ModelType,
  StreamingManager
} from '@igris-inertial/javascript-sdk';

/**
 * Example 1: Initialize client with API key
 */
async function initializeWithAPIKey() {
  const client = new IgrisClient({
    apiKey: process.env.IGRIS_API_KEY,
    baseUrl: 'https://api.igris-inertial.com',
    debug: true
  });

  // Test connection
  try {
    const health = await client.testConnection();
    console.log('Connection successful:', health);
  } catch (error) {
    console.error('Connection failed:', error);
  }

  return client;
}

/**
 * Example 2: User authentication
 */
async function authenticateUser() {
  const client = new IgrisClient({
    baseUrl: 'https://api.igris-inertial.com'
  });

  try {
    // Login
    const tokenResponse = await client.auth.login(
      'user@example.com',
      'password123',
      true // remember me
    );
    
    console.log('Login successful:', {
      user: tokenResponse.user?.email,
      expiresIn: tokenResponse.expires_in
    });

    // Get current user info
    const user = await client.auth.getCurrentUser();
    console.log('Current user:', user);

  } catch (error) {
    console.error('Authentication failed:', error);
  }

  return client;
}

/**
 * Example 3: File upload and data processing
 */
async function processDataFile(client: IgrisClient) {
  // In browser environment
  if (typeof window !== 'undefined') {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (file) {
      try {
        const result = await client.data.processFile(file, {
          dataFormat: DataFormat.CSV,
          processingMode: ProcessingMode.BATCH,
          outputFormat: DataFormat.JSON,
          transformations: [
            {
              name: 'clean_data',
              type: 'filter',
              parameters: { remove_nulls: true }
            },
            {
              name: 'normalize',
              type: 'map',
              parameters: { method: 'min_max' }
            }
          ],
          onProgress: (progress) => {
            console.log(`Processing: ${progress.percentage}%`);
          }
        });

        if (result.success) {
          console.log('Processing completed:', result.data);
          
          // Wait for job completion
          const finalResult = await client.data.waitForJob(result.data.job_id);
          console.log('Final result:', finalResult);
        }
      } catch (error) {
        console.error('Processing failed:', error);
      }
    }
  }

  // Process from URL
  try {
    const urlResult = await client.data.processUrl(
      'https://example.com/data.csv',
      DataFormat.CSV,
      {
        outputFormat: DataFormat.JSON,
        transformations: [
          {
            name: 'profile_data',
            type: 'aggregate'
          }
        ]
      }
    );

    console.log('URL processing started:', urlResult);
  } catch (error) {
    console.error('URL processing failed:', error);
  }
}

/**
 * Example 4: Machine Learning Pipeline
 */
async function trainMLModel(client: IgrisClient) {
  try {
    // Create ML pipeline
    const pipelineResponse = await client.ml.createPipeline({
      name: 'Sales Prediction Model',
      task_type: MLTaskType.REGRESSION,
      model_type: ModelType.RANDOM_FOREST,
      target_column: 'sales',
      feature_columns: ['price', 'marketing_spend', 'season'],
      description: 'Predict monthly sales based on price and marketing',
      auto_hyperparameter_tuning: true,
      evaluation_metrics: ['mse', 'r2_score']
    });

    if (!pipelineResponse.success) {
      throw new Error('Failed to create pipeline');
    }

    const pipelineId = pipelineResponse.data.pipeline_id;
    console.log('Pipeline created:', pipelineId);

    // In browser - train with file upload
    if (typeof window !== 'undefined') {
      const trainingFile = document.querySelector('#training-file') as HTMLInputElement;
      const file = trainingFile?.files?.[0];

      if (file) {
        const trainingJob = await client.ml.trainModel(pipelineId, file, {
          onProgress: (progress) => {
            console.log(`Training progress: ${progress.percentage}%`);
          },
          featureEngineering: {
            auto_feature_selection: true,
            scaling_method: 'standard',
            handle_missing: 'mean'
          }
        });

        if (trainingJob.success) {
          console.log('Training started:', trainingJob.data.job_id);
          
          // Wait for training completion
          const completedTraining = await client.ml.waitForTraining(
            trainingJob.data.job_id,
            5000, // Poll every 5 seconds
            1800000 // 30 minute timeout
          );

          console.log('Training completed:', completedTraining);
        }
      }
    }

    // Train with URL
    const trainingFromUrl = await client.ml.trainModel(
      pipelineId,
      'https://example.com/training-data.csv'
    );

    console.log('URL training started:', trainingFromUrl);

  } catch (error) {
    console.error('ML training failed:', error);
  }
}

/**
 * Example 5: Make predictions
 */
async function makePredictions(client: IgrisClient) {
  try {
    // Single prediction
    const prediction = await client.ml.predict({
      model_id: 'model_12345',
      input_data: {
        price: 29.99,
        marketing_spend: 1000,
        season: 'winter'
      },
      return_probabilities: true,
      explain_predictions: true
    });

    console.log('Prediction result:', prediction);

    // Batch predictions
    if (typeof window !== 'undefined') {
      const predictionFile = document.querySelector('#prediction-file') as HTMLInputElement;
      const file = predictionFile?.files?.[0];

      if (file) {
        const batchJob = await client.ml.batchPredict('model_12345', file, {
          returnProbabilities: true,
          onProgress: (progress) => {
            console.log(`Prediction progress: ${progress.percentage}%`);
          }
        });

        console.log('Batch prediction started:', batchJob);
      }
    }
  } catch (error) {
    console.error('Prediction failed:', error);
  }
}

/**
 * Example 6: File storage management
 */
async function manageFiles(client: IgrisClient) {
  if (typeof window === 'undefined') return;

  try {
    // Upload file
    const fileInput = document.querySelector('#file-input') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (file) {
      const upload = await client.storage.uploadFile(file, {
        tags: ['dataset', 'sales'],
        metadata: { source: 'sales_team', year: '2024' },
        onProgress: (progress) => {
          console.log(`Upload: ${progress.percentage}%`);
        }
      });

      console.log('File uploaded:', upload);

      if (upload.success) {
        const fileId = upload.data.file_id;

        // Get file info
        const fileInfo = await client.storage.getFile(fileId);
        console.log('File info:', fileInfo);

        // Create share link
        const shareLink = await client.storage.createShareLink(fileId, {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          allowDownload: true
        });

        console.log('Share link created:', shareLink);

        // Get download URL
        const downloadUrl = client.storage.getDownloadUrl(fileId);
        console.log('Download URL:', downloadUrl);
      }
    }

    // List files
    const files = await client.storage.listFiles({
      tags: ['dataset'],
      sortBy: 'upload_date',
      sortOrder: 'desc'
    });

    console.log('Files:', files);

  } catch (error) {
    console.error('File management failed:', error);
  }
}

/**
 * Example 7: Real-time streaming
 */
async function setupRealTimeStreaming(client: IgrisClient) {
  try {
    const streaming = new StreamingManager({
      baseUrl: client.baseUrl,
      apiKey: process.env.IGRIS_API_KEY,
      debug: true
    });

    await streaming.initialize();

    // Subscribe to data processing events
    streaming.subscribeToDataProcessing({
      onEvent: (event) => {
        console.log('Data processing event:', event);
      },
      onError: (error) => {
        console.error('Stream error:', error);
      }
    });

    // Subscribe to ML training events
    streaming.subscribeToMLTraining({
      onEvent: (event) => {
        console.log('ML training event:', event);
      }
    });

    // Subscribe to specific job
    const jobSubscription = streaming.subscribeToJob('job_12345', {
      onEvent: (event) => {
        console.log('Job update:', event);
      }
    });

    // Subscribe to system alerts
    streaming.subscribeToAlerts({
      onEvent: (event) => {
        console.log('System alert:', event);
      }
    });

    // Handle connection events
    streaming.on('connected', () => {
      console.log('Streaming connected');
    });

    streaming.on('disconnected', () => {
      console.log('Streaming disconnected');
    });

    streaming.on('error', (error) => {
      console.error('Streaming error:', error);
    });

    // Later unsubscribe
    setTimeout(() => {
      streaming.unsubscribe(jobSubscription);
    }, 60000);

    return streaming;

  } catch (error) {
    console.error('Streaming setup failed:', error);
  }
}

/**
 * Example 8: System monitoring
 */
async function monitorSystem(client: IgrisClient) {
  try {
    // Get system health
    const health = await client.monitoring.getHealth();
    console.log('System health:', health);

    // Get real-time metrics
    const metrics = await client.monitoring.getRealtimeMetrics();
    console.log('Current metrics:', metrics);

    // Get usage statistics
    const usage = await client.monitoring.getUsageStats({
      period: 'day'
    });
    console.log('Usage stats:', usage);

    // Create alert
    const alert = await client.monitoring.createAlert({
      name: 'High CPU Usage',
      metric: 'cpu_usage',
      condition: 'greater_than',
      threshold: 85,
      duration_minutes: 5,
      notification_channels: ['email', 'slack'],
      is_active: true
    });

    console.log('Alert created:', alert);

  } catch (error) {
    console.error('Monitoring failed:', error);
  }
}

/**
 * Main example function
 */
async function main() {
  console.log('Starting Igris-engine SDK examples...');

  try {
    // Choose authentication method
    const client = process.env.IGRIS_API_KEY 
      ? await initializeWithAPIKey()
      : await authenticateUser();

    // Run examples
    await processDataFile(client);
    await trainMLModel(client);
    await makePredictions(client);
    await manageFiles(client);
    await monitorSystem(client);
    
    // Setup streaming
    const streaming = await setupRealTimeStreaming(client);

    // Cleanup after 5 minutes
    setTimeout(async () => {
      streaming?.close();
      await client.close();
      console.log('SDK examples completed');
    }, 300000);

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  initializeWithAPIKey,
  authenticateUser,
  processDataFile,
  trainMLModel,
  makePredictions,
  manageFiles,
  setupRealTimeStreaming,
  monitorSystem
};