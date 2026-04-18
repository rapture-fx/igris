import { IgrisClient } from '@igris-inertial/sdk';

const client = new IgrisClient({
  baseUrl: 'https://overture.igrisinertial.com',
  apiKey: process.env.IGRIS_API_KEY,
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(response.choices[0].message.content);
