// Minimal JavaScript stub implementation for web-landing build compatibility

interface ApiError {
  message: string;
  code?: string;
  status?: number;
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

export interface StreamChunkEvent {
  type: 'chunk';
  data: Record<string, unknown>;
}

export interface StreamTaskResultEvent {
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

export interface StreamDoneEvent {
  type: 'done';
}

export interface StreamErrorEvent {
  type: 'error';
  data: Record<string, unknown>;
}

export type DurableStreamEvent =
  | StreamChunkEvent
  | StreamTaskResultEvent
  | StreamDoneEvent
  | StreamErrorEvent;

class AuthManager {
  constructor(_config: any) {}
  
  async login(_email: string, _password: string) {
    return null;
  }
  
  async logout() {}
  
  async refresh() {}
  
  async handleOAuthCallback(_params: { code: string; provider: string }) {
    return null;
  }
  
  isAuthenticated() {
    return false;
  }
  
  getCurrentUser() {
    return null;
  }
}

const createTokenStorage = () => ({
  getTokens: () => null,
  setTokens: () => {},
  clearTokens: () => {}
});

class IgrisClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: any = {}) {
    this.baseUrl = (config.baseUrl || 'https://overture.igrisinertial.com').replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }
  
  async upload(_file: File) {
    return null;
  }
  
  async processData(_data: any) {
    return null;
  }

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
      let message = `stream request failed with status ${response.status}`;
      try {
        const payload = await response.json();
        if (payload?.error?.message) {
          message = payload.error.message;
        }
      } catch {}
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('stream response did not contain a body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = 'message';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separatorIndex = buffer.indexOf('\n\n');
        if (separatorIndex === -1) {
          break;
        }

        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        let dataLines: string[] = [];
        eventName = 'message';

        for (const line of rawEvent.split('\n')) {
          const trimmed = line.replace(/\r$/, '');
          if (!trimmed || trimmed.startsWith(':')) {
            continue;
          }
          if (trimmed.startsWith('event:')) {
            eventName = trimmed.slice('event:'.length).trim();
            continue;
          }
          if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice('data:'.length).trimStart());
          }
        }

        if (dataLines.length === 0) {
          continue;
        }

        const payload = dataLines.join('\n');
        if (payload === '[DONE]') {
          yield { type: 'done' };
          continue;
        }

        const parsed = JSON.parse(payload) as Record<string, unknown>;

        if (eventName === 'task_result') {
          yield {
            type: 'task_result',
            data: parsed as StreamTaskResultEvent['data'],
          };
          continue;
        }

        if (parsed.object === 'error' || parsed.error) {
          yield { type: 'error', data: parsed };
          continue;
        }

        yield { type: 'chunk', data: parsed };
      }
    }
  }
}

export { AuthManager, createTokenStorage, IgrisClient };
export type { ApiError };
export default IgrisClient;
