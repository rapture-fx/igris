import { IgrisClient } from '@igris-inertial/sdk';

const client = new IgrisClient({
  baseUrl: 'https://overture.igrisinertial.com',
  apiKey: process.env.IGRIS_API_KEY,
});

const result = await client.getActionResult('018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c');
console.log(result.status, result.proof_status);
