import { IgrisClient } from '@igris-inertial/sdk';

export function createIgrisClient() {
  const apiKey = process.env.IGRIS_API_KEY;
  if (!apiKey) {
    throw new Error('IGRIS_API_KEY is required');
  }

  return new IgrisClient({
    baseUrl: process.env.IGRIS_BASE_URL ?? 'https://overture.igrisinertial.com',
    apiKey,
  });
}
