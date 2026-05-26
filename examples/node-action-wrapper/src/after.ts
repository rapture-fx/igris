import { IgrisClient } from '@igris-inertial/sdk';

type IssueInput = {
  repo: string;
  title: string;
  body: string;
};

async function createIssue(input: IssueInput) {
  return {
    repo: input.repo,
    number: 101,
    url: `https://github.example/${input.repo}/issues/101`,
  };
}

async function fakeAgentDecision(): Promise<IssueInput> {
  return {
    repo: 'acme/app',
    title: 'Bug from agent',
    body: 'The support agent found a reproducible billing edge case.',
  };
}

const igris = new IgrisClient({
  apiKey: process.env.IGRIS_API_KEY ?? 'igris_dev_placeholder',
  baseUrl: process.env.IGRIS_BASE_URL ?? 'http://localhost:8080',
});

const issue = await fakeAgentDecision();

const result = await igris.runAction(
  'github.create_issue',
  {
    method: 'POST',
    url: process.env.MOCK_ISSUES_URL ?? 'http://localhost:8787/issues',
    body: issue,
  },
  {
    runtimeTarget: 'http_request',
    metadata: {
      agent_id: 'support-agent',
      user_id: 'user_123',
    },
  },
);

console.log('Igris action result:', {
  task_id: result.task_id,
  execution_id: result.execution_id,
  status: result.status,
  proof_status: result.proof_status,
  console_url: result.console_url,
});

const createIssueThroughIgris = igris.wrapTool('github.create_issue', createIssue, {
  runtimeTarget: 'http_request',
});

void createIssueThroughIgris;
