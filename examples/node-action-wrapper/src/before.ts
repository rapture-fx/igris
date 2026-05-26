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

const issue = await fakeAgentDecision();
const result = await createIssue(issue);

console.log('Direct tool result:', result);
