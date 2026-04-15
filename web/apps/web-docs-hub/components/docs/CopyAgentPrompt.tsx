'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyAgentPromptProps {
  product?: 'cloud-api';
  title?: string;
  description?: string;
}

function buildCloudApiPrompt(): string {
  return `Implement Igris using the hosted OpenAI-compatible API.

Requirements:
- Use the OpenAI SDK already present in this codebase if available.
- Point the client base URL to https://overture.igrisinertial.com/v1
- Authenticate with IGRIS_API_KEY from environment variables.
- Keep the integration compatible with OpenAI chat completions usage.
- Do not hardcode secrets.
- Add clear environment variable documentation where this project keeps setup instructions.
- If the application already has an AI client abstraction, integrate Igris through that abstraction instead of adding a second parallel path.
- Preserve existing error handling, logging, and configuration patterns in this repo.

Implementation target:
- Replace or add the application AI client so requests can be sent through Igris.
- Start with a minimal working chat completion request.
- Keep the model configurable through application config or env.
- Use a safe default model value if one is required.

Igris integration details:
- Base URL: https://overture.igrisinertial.com/v1
- Auth header: Authorization: Bearer \${process.env.IGRIS_API_KEY}
- Compatible endpoint pattern: /chat/completions via the OpenAI SDK client

Expected deliverables:
1. Code changes required to route requests through Igris.
2. Any env/config additions required for IGRIS_API_KEY and model selection.
3. A short verification step showing how to test the integration locally.
4. Do not add mock code unless the existing codebase already uses it for integration tests.

Reference implementation shape:
\`\`\`ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://overture.igrisinertial.com/v1',
  apiKey: process.env.IGRIS_API_KEY,
});
\`\`\`

If this repository is not using JavaScript or TypeScript, adapt the same hosted OpenAI-compatible integration approach to the primary language and existing HTTP/client patterns in the codebase.`;
}

export function CopyAgentPrompt({
  product = 'cloud-api',
  title = 'Copy This Prompt',
  description = 'Copy an implementation prompt for your coding agent so it can wire Igris into your app.',
}: CopyAgentPromptProps) {
  const [copied, setCopied] = useState(false);

  const prompt = product === 'cloud-api' ? buildCloudApiPrompt() : '';

  async function onCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  return (
    <div className="docs-agent-prompt not-prose">
      <div className="docs-agent-prompt-copy">
        <div className="docs-agent-prompt-copy-text">
          <p className="docs-agent-prompt-title">{title}</p>
          <p className="docs-agent-prompt-description">{description}</p>
        </div>
        <button type="button" className="docs-agent-prompt-button" onClick={() => void onCopy()}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy This Prompt'}
        </button>
      </div>
    </div>
  );
}
