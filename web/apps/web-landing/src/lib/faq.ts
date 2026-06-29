export interface FaqEntry {
  id: string
  question: string
  answer: string
  category: FaqCategory
  tags: string[]
}

export type FaqCategory =
  | 'getting-started'
  | 'pricing-billing'
  | 'execution-verification'
  | 'open-source'
  | 'deployment-security'

export const CATEGORY_LABELS: Record<FaqCategory, string> = {
  'getting-started': 'Getting Started',
  'pricing-billing': 'Pricing & Billing',
  'execution-verification': 'Execution & Verification',
  'open-source': 'Open Source & Self-hosting',
  'deployment-security': 'Deployment & Security',
}

export const FAQ_DATA: FaqEntry[] = [
  {
    id: 'try-before-commit',
    question: 'Can I try Igris before committing?',
    answer:
      'Yes. Seed is the paid developer entry tier, but it is designed for a low-friction first evaluation: one project, one execution environment, hosted actions, signed receipts, and console visibility so you can validate recoverable agent work before scaling up. If you are evaluating Igris for production, private deployment, or a larger team rollout, you can request a guided private preview with architecture review and validation support.',
    category: 'getting-started',
    tags: ['seed', 'trial'],
  },
  {
    id: 'who-is-seed',
    question: 'Who is Seed for?',
    answer:
      'Seed is for individual builders and small teams testing controlled agent actions in a single project. It includes one execution environment, hosted actions, signed receipts, basic receipt verification, API and MCP access, and short retention — enough to connect an agent, run real actions, inspect what happened, and decide whether Igris fits your workflow before moving to Horizon.',
    category: 'getting-started',
    tags: ['seed', 'tier'],
  },
  {
    id: 'igris-vs-provider',
    question: 'How is Igris different from using OpenAI or Anthropic directly?',
    answer:
      'Calling a model provider directly works well for chat, drafting, and low-risk generation. Igris sits at the point where model output becomes operational work: calling APIs, changing records, triggering workflows, accessing files, and coordinating recovery when something fails. Instead of giving agents broad direct access, Igris routes important actions through one controlled path with policy checks, execution evidence, signed receipts, and a record your team can review afterward.',
    category: 'getting-started',
    tags: ['comparison', 'providers'],
  },
  {
    id: 'execution-environment',
    question: 'What is an execution environment?',
    answer:
      'An execution environment is the configured surface where Igris can run or coordinate agent task execution. Depending on your setup, that may be a hosted Igris Cloud environment, a connected worker in your network, or a private deployment surface. Plans limit how many environments you can use at once, because each environment represents a distinct place where actions can run and be audited.',
    category: 'pricing-billing',
    tags: ['environment'],
  },
  {
    id: 'agent-task-run',
    question: 'What is an agent task run?',
    answer:
      'An agent task run is one submitted unit of work executed through Igris. A single run can include multiple committed actions, policy decisions, recovery steps, action evidence, and signed receipts. Billing counts these runs because they represent real controlled execution — not just a model response — and each run produces inspectable state your team can review in the console or through the API.',
    category: 'pricing-billing',
    tags: ['task', 'run'],
  },
  {
    id: 'verified-task-run',
    question: 'What is a verified task run?',
    answer:
      'A verified task run is a completed run whose execution metadata and signed receipt can be inspected and checked after the action finishes. Verification gives your team a way to confirm what was requested, what ran, and what evidence Igris retained — without relying only on the agent’s summary of events.',
    category: 'pricing-billing',
    tags: ['verification'],
  },
  {
    id: 'model-inference-cost',
    question: 'Do I pay for model inference?',
    answer:
      'No. Igris pricing covers the action layer — hosted execution, retention, team access, receipts, and operator tooling — not provider inference. You bring your own model keys or configured execution path, and any model usage is billed separately by the provider you choose.',
    category: 'pricing-billing',
    tags: ['pricing', 'inference'],
  },
  {
    id: 'upgrade-downgrade',
    question: 'Can I upgrade or downgrade?',
    answer:
      'Yes. You can move between plans as your project count, execution environments, action volume, retention needs, and team access requirements change. Upgrades typically take effect immediately. Downgrades apply according to your billing cycle and current account state, so limits like environment count or retention may adjust at the next renewal.',
    category: 'pricing-billing',
    tags: ['billing'],
  },
  {
    id: 'infinite-pricing',
    question: 'Why is Infinite custom priced?',
    answer:
      'Infinite is for teams that need private deployment, custom retention, advanced audit exports, dedicated onboarding, and security review support. Those requirements vary widely by organization, so custom pricing lets the deployment scope match the operational and governance needs instead of forcing every advanced customer into one fixed plan.',
    category: 'pricing-billing',
    tags: ['infinite', 'pricing'],
  },
  {
    id: 'what-verify',
    question: 'What does Igris verify?',
    answer:
      'Igris verifies execution after important agent actions complete. It produces signed receipts, action evidence, and run metadata so your team can inspect what was allowed, what ran, what failed, what recovered, and what record exists afterward. The exact verification path depends on your deployment surface and proof configuration, but the goal is the same: make agent work reviewable without exposing unnecessary sensitive data.',
    category: 'execution-verification',
    tags: ['verification', 'proof'],
  },
  {
    id: 'smarter-model',
    question: 'Does Igris make the model smarter?',
    answer:
      'No. Igris does not improve model reasoning, writing quality, or answer accuracy. It makes agent execution safer to trust once model output becomes work: checking whether an action is allowed, running it through the right path, handling failure when possible, and keeping proof your team can inspect later.',
    category: 'execution-verification',
    tags: ['models'],
  },
  {
    id: 'fallback',
    question: 'Does Igris handle fallback automatically?',
    answer:
      'Igris supports configured recovery and failure paths, but the behavior depends on your deployment, action definitions, and proof setup. Recovery-sensitive workflows should be tested in your environment before you rely on them in production, so your team understands exactly what will retry, stop, or escalate when an action fails.',
    category: 'execution-verification',
    tags: ['recovery', 'fallback'],
  },
  {
    id: 'without-dashboard',
    question: 'Can I use Igris without the dashboard?',
    answer:
      'Yes. Igris can be used entirely through the API, SDK, or MCP integration. The console is optional operator tooling that makes it easier to review task runs, action evidence, receipts, verification state, and account controls — but it is not required to route actions or collect proof programmatically.',
    category: 'execution-verification',
    tags: ['api', 'console'],
  },
  {
    id: 'self-host',
    question: 'Can I self-host Igris?',
    answer:
      'You can run Igris yourself with the open-source runtime, and private managed deployment is available through Infinite. The exact deployment model, retention policy, support scope, and security requirements are defined during evaluation so the setup matches how your team operates.',
    category: 'open-source',
    tags: ['self-host', 'private'],
  },
  {
    id: 'oss-vs-cloud',
    question: 'What is the difference between open source and Igris Cloud?',
    answer:
      'Open source gives you the runtime and core execution components to run Igris in your own environment. Igris Cloud adds a hosted control plane with managed execution surfaces, billing, team access, retention, and the operator console — a faster path for teams that want hosted infrastructure instead of operating the full stack themselves.',
    category: 'open-source',
    tags: ['open-source', 'cloud'],
  },
  {
    id: 'cloud-data',
    question: 'Is my data sent to the cloud?',
    answer:
      'That depends on the execution surface you configure. Provider-backed execution sends requests to the provider you select. Local execution, connected workers, and private deployment keep work closer to the environment you control. Igris should be configured to match your data residency, network, and security requirements.',
    category: 'deployment-security',
    tags: ['data', 'cloud'],
  },
  {
    id: 'train-on-data',
    question: 'Do you train on my data?',
    answer:
      'No. Igris does not train foundation models on your data. If you connect external model providers, their data handling depends on the provider and the account settings you choose with that provider.',
    category: 'deployment-security',
    tags: ['privacy', 'data'],
  },
  {
    id: 'security-controls',
    question: 'What security controls are available?',
    answer:
      'Igris is designed around controlled execution: permission checks before actions run, approval paths where needed, signed receipts and recovery evidence after execution, and operator visibility through the console and API. The exact controls available depend on your plan and deployment mode, with broader governance and audit options on higher tiers and private deployments.',
    category: 'deployment-security',
    tags: ['security'],
  },
]