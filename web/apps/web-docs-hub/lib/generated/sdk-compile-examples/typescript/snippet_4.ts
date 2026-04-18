import { IgrisClient } from '@igris-inertial/sdk';

const client = new IgrisClient({
  baseUrl: process.env.IGRIS_BASE_URL ?? 'https://overture.igrisinertial.com',
  apiKey: process.env.IGRIS_API_KEY,
});

const task = await client.tasks.submit({
  task_type: 'single_inference',
  task_definition: {
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: 'Summarize the deployment risk.' }],
  },
  idempotency_key: 'deployment-risk-2026-04-18',
});

const completed = await client.tasks.waitForCompletion(task.task_id);
console.log(completed.status);
