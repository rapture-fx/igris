// Minimal stub implementation for web-landing build
// This provides just the exports needed by the web-landing app

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export interface InferMessage {
  role: string;
  content: string;
}

export interface StreamInferRequest {
  model: string;
  messages: InferMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  speculative_mode?: string;
  council_mode?: boolean;
}

export type DurableStreamEvent =
  | { type: 'chunk'; data: Record<string, unknown> }
  | {
      type: 'task_result';
      data: {
        task_id: string;
        steps_completed: number;
        steps_total: number;
        status: unknown;
        checkpoint?: unknown;
        final_output?: string;
        usage?: unknown;
        execution_envelope?: unknown;
        execution_receipt?: unknown;
      };
    }
  | { type: 'error'; data: Record<string, unknown> }
  | { type: 'done' };

export class AuthManager {
  constructor(_config: any) {}
  async login(_email: string, _password: string): Promise<any> { return null; }
  async logout(): Promise<void> {}
  async refresh(): Promise<void> {}
  isAuthenticated(): boolean { return false; }
  getCurrentUser(): any { return null; }
}

export const createTokenStorage = (): any => ({
  getTokens: () => null,
  setTokens: () => {},
  clearTokens: () => {}
});

export class IgrisClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: any = {}) {
    this.baseUrl = (config.baseUrl || 'https://overture.igrisinertial.com').replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }
  async upload(_file: File): Promise<any> { return null; }
  async processData(_data: any): Promise<any> { return null; }
  async *streamInference(request: StreamInferRequest): AsyncGenerator<DurableStreamEvent> {
    const response = await fetch(`${this.baseUrl}/v1/infer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`stream request failed with status ${response.status}`);
    }
    if (!response.body) {
      throw new Error('stream response did not contain a body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separatorIndex = buffer.indexOf('\n\n');
        if (separatorIndex === -1) break;

        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of rawEvent.split('\n')) {
          const trimmed = line.replace(/\r$/, '');
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('event:')) {
            eventName = trimmed.slice('event:'.length).trim();
            continue;
          }
          if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice('data:'.length).trimStart());
          }
        }

        if (dataLines.length === 0) continue;
        const payload = dataLines.join('\n');
        if (payload === '[DONE]') {
          yield { type: 'done' };
          continue;
        }

        const parsed = JSON.parse(payload) as Record<string, unknown>;
        if (eventName === 'task_result') {
          yield {
            type: 'task_result',
            data: parsed as Extract<DurableStreamEvent, { type: 'task_result' }>['data'],
          };
        } else if (parsed.object === 'error' || parsed.error) {
          yield { type: 'error', data: parsed };
        } else {
          yield { type: 'chunk', data: parsed };
        }
      }
    }
  }
}

export const SDK_INFO = {
  version: '1.0.0',
  name: '@igris-inertial/javascript-sdk'
};

export default IgrisClient;
