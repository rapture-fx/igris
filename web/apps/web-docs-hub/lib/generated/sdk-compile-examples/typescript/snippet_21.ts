import { IgrisClient } from '@igris-inertial/sdk';

type IgrisMode = 'cloud' | 'local' | 'hybrid';

export function createIgrisClientForMode(mode: IgrisMode) {
  const baseUrlByMode = {
    cloud: 'https://overture.igrisinertial.com',
    local: 'http://localhost:8080',
    hybrid: 'https://overture.igrisinertial.com',
  } as const;

  return new IgrisClient({
    baseUrl: process.env.IGRIS_BASE_URL ?? baseUrlByMode[mode],
    apiKey: process.env.IGRIS_API_KEY,
  });
}
