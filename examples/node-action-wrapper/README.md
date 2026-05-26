# Node Action Wrapper Example

This example shows the line of code that changes when Igris sits between an agent and a tool.

Before:

```ts
const result = await createIssue(issue);
```

After:

```ts
const result = await igris.runAction('github.create_issue', {
  method: 'POST',
  url: 'http://localhost:8787/issues',
  body: issue,
}, { runtimeTarget: 'http_request' });
```

Your LLM stack stays in your app. Igris wraps the action execution path so policy, runtime boundaries, recovery, receipts, and proof status attach to the action.

No real GitHub token is required by default. The URL is intended to be a mock local HTTP endpoint or a registered runtime action target.
