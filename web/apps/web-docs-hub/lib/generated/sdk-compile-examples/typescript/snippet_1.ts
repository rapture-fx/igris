import { IgrisClient } from '@igris-inertial/sdk';

const client = new IgrisClient({
  baseUrl: 'https://overture.igrisinertial.com',
  apiKey: process.env.IGRIS_API_KEY,
});

const run = await client.runAction(
  'send_invoice',
  { customer_id: 'cus_8821', amount: 4200 },
  { idempotencyKey: 'invoice-8821-2026-06', wait: true },
);

console.log(run.status, run.proof_status);
