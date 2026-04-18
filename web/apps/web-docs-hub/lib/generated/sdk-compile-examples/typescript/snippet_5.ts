import { IgrisClient } from '@igris-inertial/sdk';

const client = new IgrisClient({
  baseUrl: process.env.IGRIS_BASE_URL ?? 'https://overture.igrisinertial.com',
  apiKey: process.env.IGRIS_API_KEY,
});

try {
  const task = await client.tasks.submit({
    task_type: 'single_inference',
    task_definition: {
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Replay the last durable task.' }],
    },
    idempotency_key: 'deployment-risk-2026-04-18',
  });

  const finalTask = await client.tasks.waitForCompletion(task.task_id);
  if (finalTask.status === 'failed') {
    console.warn('Task failed:', finalTask.failure_reason);
  }
} catch (error) {
  console.warn('Durable task request failed:', error);
}
