/**
 * Igris Inertial — Node.js hello world
 * Requires: npm install @igris-inertial/sdk
 *
 * Usage:
 *   export IGRIS_API_KEY=igris_...
 *   node hello_world.js
 */

import { IgrisClient } from '@igris-inertial/sdk';

const apiKey = process.env.IGRIS_API_KEY;
if (!apiKey) {
  console.error('Set IGRIS_API_KEY first: export IGRIS_API_KEY=igris_...');
  process.exit(1);
}

const client = new IgrisClient({
  baseUrl: 'https://overture.igrisinertial.com',
  apiKey,
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello! Reply in one sentence.' }],
  max_tokens: 64,
});

console.log(response.choices[0].message.content);
console.log(`Provider : ${response.metadata?.provider ?? '—'}`);
console.log(`Latency  : ${response.metadata?.latency_ms ?? '—'} ms`);
console.log(`Cost     : $${response.metadata?.cost_usd?.toFixed(6) ?? '—'}`);
