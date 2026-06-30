import { DOCS_LINKS } from './docs-urls'

export interface FaqSource {
  href: string
  label: string
}

export interface FaqEntry {
  id: string
  question: string
  answer: string[]
  source: FaqSource
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
    answer: [
      'Every tier comes with a 7-day trial and you do not need a credit card to start. That is enough time to connect an agent, run governed actions, and inspect signed records before you commit to a paid plan.',
      'On Seed, you get one project, one execution environment, and hosted actions with console visibility. You can validate that recoverable agent work fits your workflow without scaling up first.',
      'If you are evaluating Igris for production, private deployment, or a larger team rollout, you can also request a guided private preview with architecture review and validation support.',
    ],
    source: { href: DOCS_LINKS.pricingTiers, label: 'Pricing & Tiers' },
    category: 'getting-started',
    tags: ['seed', 'trial'],
  },
  {
    id: 'who-is-seed',
    question: 'Who is Seed for?',
    answer: [
      'Seed is built for individual builders and small teams testing controlled agent actions in a single project. It is the smallest paid footprint for teams that want to start running governed, verifiable AI tasks.',
      'You get one execution environment, up to 2,500 verified runs per month, and 7-day retention. That includes hosted actions, signed receipts, basic receipt verification, and API and MCP access.',
      'It is enough to connect an agent, run real actions, inspect what happened, and decide whether Igris fits your workflow before moving to Horizon.',
    ],
    source: { href: DOCS_LINKS.pricingTiers, label: 'Pricing & Tiers' },
    category: 'getting-started',
    tags: ['seed', 'tier'],
  },
  {
    id: 'igris-vs-provider',
    question: 'How is Igris different from using OpenAI or Anthropic directly?',
    answer: [
      'Calling a model provider directly works well for chat, drafting, and low-risk generation. That path is fine when you only need a response and do not need a durable record of what the agent actually did.',
      'Igris sits at the point where model output becomes operational work: calling APIs, changing records, triggering workflows, accessing files, and coordinating recovery when something fails.',
      'Instead of giving agents broad direct access, it routes important actions through one controlled path with policy checks, execution boundaries, and signed records your team can review afterward.',
    ],
    source: { href: DOCS_LINKS.platform, label: 'Execution Model' },
    category: 'getting-started',
    tags: ['comparison', 'providers'],
  },
  {
    id: 'execution-environment',
    question: 'What is an execution environment?',
    answer: [
      'An execution environment is the configured surface where Igris can run or coordinate agent task execution. It is the place where actions actually run and where audit records are tied back to a specific deployment context.',
      'Depending on your setup, that may be a hosted Igris Cloud environment, a connected worker in your network, or a private deployment surface. Hosted, local, and hybrid modes all fit under the same execution model.',
      'Plans limit how many environments you can use at once, because each one represents a distinct place where actions can run and be audited.',
    ],
    source: { href: DOCS_LINKS.deployment, label: 'Deployment' },
    category: 'pricing-billing',
    tags: ['environment'],
  },
  {
    id: 'agent-task-run',
    question: 'What is an agent task run?',
    answer: [
      'An agent task run is one submitted unit of work executed through Igris. It follows the Request, Execute, and Verify model: work enters through one execution system, runs under policy and capability boundaries, and produces records you can inspect after the run.',
      'A single run can include multiple committed actions, policy decisions, recovery steps, action evidence, and signed receipts. That is different from a plain model response, which does not carry the same governed execution context.',
      'Billing counts these runs because they represent real controlled execution, and each run produces inspectable state your team can review in the console or through the API.',
    ],
    source: { href: DOCS_LINKS.platform, label: 'Execution Model' },
    category: 'pricing-billing',
    tags: ['task', 'run'],
  },
  {
    id: 'verified-task-run',
    question: 'What is a verified task run?',
    answer: [
      'A verified task run is a completed run whose execution metadata and signed receipt can be inspected and checked after the action finishes. Plans meter verified runs per month as the primary unit of governed execution.',
      'Verification gives your team a way to confirm what was requested, what ran, and what evidence Igris retained. You are not relying only on the agent summary of events.',
      'Depending on your deployment, Igris can return execution metadata, signed envelopes, signed receipts, and receipt hashes. The exact verification surface varies, but the intent is the same: post-run proof you can review.',
    ],
    source: { href: DOCS_LINKS.verification, label: 'Verification' },
    category: 'pricing-billing',
    tags: ['verification'],
  },
  {
    id: 'model-inference-cost',
    question: 'Do I pay for model inference?',
    answer: [
      'Igris pricing covers the action layer: hosted execution, retention for signed records and run history, operator surfaces, team workflows, and deployment flexibility. It is organized around execution-environment capacity and the records your team needs to review.',
      'You bring your own model keys or configured execution path. When Igris routes a request to a cloud provider, inference is subject to that provider billing and privacy terms.',
      'In short, Igris bills for governed execution and operator access. Provider inference is billed separately by whichever model provider you connect.',
    ],
    source: { href: DOCS_LINKS.pricingTiers, label: 'Pricing & Tiers' },
    category: 'pricing-billing',
    tags: ['pricing', 'inference'],
  },
  {
    id: 'upgrade-downgrade',
    question: 'Can I upgrade or downgrade?',
    answer: [
      'Yes. You can move between plans as your project count, execution environments, action volume, retention needs, and team access requirements change.',
      'Upgrades typically take effect immediately, so you can expand capacity when a rollout grows. Downgrades apply according to your billing cycle and current account state.',
      'Limits like environment count, verified run volume, or retention may adjust at the next renewal. Use the billing API to check your active tier, capacity in use, and whether an upgrade path is available.',
    ],
    source: { href: DOCS_LINKS.trialBilling, label: 'Trial & Billing' },
    category: 'pricing-billing',
    tags: ['billing'],
  },
  {
    id: 'infinite-pricing',
    question: 'Why is Infinite custom priced?',
    answer: [
      'Infinite is for organizations that need larger deployment scope and private deployment flexibility. That includes custom execution-environment footprints, custom run volume, and governance requirements that do not fit a fixed monthly plan.',
      'Teams on Infinite often need custom retention, audit export, dedicated onboarding, and security review support. Those requirements vary widely by organization.',
      'Custom pricing lets the deployment scope match your operational and governance needs instead of forcing every advanced customer into one fixed plan.',
    ],
    source: { href: DOCS_LINKS.pricingTiers, label: 'Pricing & Tiers' },
    category: 'pricing-billing',
    tags: ['infinite', 'pricing'],
  },
  {
    id: 'what-verify',
    question: 'What does Igris verify?',
    answer: [
      'Igris verifies execution after important agent actions complete. Verification answers what happened, what record came back, and what can actually be checked after the run.',
      'Depending on your deployment, Igris can return or persist execution metadata, signed execution envelopes, signed execution receipts, receipt hashes, and receipt-log entries. These are related but not interchangeable: execution history is not the same thing as a signed receipt.',
      'The exact verification path depends on your deployment surface and proof configuration. The goal is the same across setups: make agent work reviewable with proof your team can inspect, without exposing unnecessary sensitive data.',
    ],
    source: { href: DOCS_LINKS.verification, label: 'Verification' },
    category: 'execution-verification',
    tags: ['verification', 'proof'],
  },
  {
    id: 'smarter-model',
    question: 'Does Igris make the model smarter?',
    answer: [
      'No. Igris does not improve model reasoning, writing quality, or answer accuracy. It does not change how the underlying model thinks or what it generates.',
      'What it does is make agent execution safer to trust once model output becomes work. That means checking whether an action is allowed, running it through the right path, and recording violations or failure outcomes instead of hiding them.',
      'After execution, Igris keeps proof your team can inspect later: metadata, signed records, and receipt-oriented audit material. The value is governed execution, not smarter inference.',
    ],
    source: { href: DOCS_LINKS.platform, label: 'Execution Model' },
    category: 'execution-verification',
    tags: ['models'],
  },
  {
    id: 'fallback',
    question: 'Does Igris handle fallback automatically?',
    answer: [
      'Igris supports configured recovery and failure paths in hybrid and runtime deployments. Hybrid architecture can route between hosted coordination and runtime participation when that is how your environment is set up.',
      'The behavior depends on your deployment, action definitions, and proof setup. Not every failover or recovery story is equally proven in every environment, so public claims should follow what your deployment actually supports.',
      'Recovery-sensitive workflows should be tested in your environment before you rely on them in production. Your team should understand exactly what will retry, stop, or escalate when an action fails.',
    ],
    source: { href: DOCS_LINKS.architecture, label: 'Architecture' },
    category: 'execution-verification',
    tags: ['recovery', 'fallback'],
  },
  {
    id: 'without-dashboard',
    question: 'Can I use Igris without the dashboard?',
    answer: [
      'Yes. Igris can be used entirely through the API, SDK, or MCP integration. Registered actions, durable tasks, and MCP tool calls all enter the same execution system regardless of which client you use.',
      'The console is optional operator tooling. It helps teams inspect execution events, run history, signed records, execution environments, and account controls in one place.',
      'You do not need the dashboard to route actions or collect proof programmatically. Many integrations run headless and only open the console when an operator needs to review a run.',
    ],
    source: { href: DOCS_LINKS.apiReference, label: 'API Reference' },
    category: 'execution-verification',
    tags: ['api', 'console'],
  },
  {
    id: 'self-host',
    question: 'Can I self-host Igris?',
    answer: [
      'You can run Igris yourself with the open-source runtime on your own infrastructure, connected workers in your network, or a hybrid path that combines hosted coordination with local execution.',
      'Local runtime is not a separate product. It is an execution surface for workloads that benefit from locality, device-level boundaries, or reduced dependence on a hosted path.',
      'Private managed deployment is also available through Infinite. Retention policy, support scope, and security requirements are defined during evaluation so the setup matches how your team operates.',
    ],
    source: { href: DOCS_LINKS.runtime, label: 'Deploy Local Runtime' },
    category: 'open-source',
    tags: ['self-host', 'private'],
  },
  {
    id: 'oss-vs-cloud',
    question: 'What is the difference between open source and Igris Cloud?',
    answer: [
      'Open source gives you the runtime and core execution components to run Igris in your own environment. You operate the binary, configure local or hybrid execution, and control where work runs.',
      'Igris Cloud adds a hosted control plane with managed execution surfaces, billing, team access, retention, and the operator console. It is the fastest path when you want provider-backed execution with less operational overhead.',
      'The deployment choice changes where execution happens. It does not create separate products. Hosted, local, and hybrid setups all fit under the same Request, Execute, and Verify model.',
    ],
    source: { href: DOCS_LINKS.deployment, label: 'Deployment' },
    category: 'open-source',
    tags: ['open-source', 'cloud'],
  },
  {
    id: 'cloud-data',
    question: 'Is my data sent to the cloud?',
    answer: [
      'That depends on the execution surface you configure. Igris supports hosted, local, and hybrid deployment modes, and each mode handles data differently.',
      'In cloud API mode, requests pass through the coordination layer for routing. Execution metadata is stored for your tier retention period, and prompt content is forwarded to the selected provider when you use provider-backed execution.',
      'When running the runtime locally, data stays on your device unless you explicitly export it. In hybrid mode, cloud requests follow cloud handling while local execution data stays on the device. Configure Igris to match your data residency, network, and security requirements.',
    ],
    source: { href: DOCS_LINKS.dataPrivacy, label: 'Data Privacy' },
    category: 'deployment-security',
    tags: ['data', 'cloud'],
  },
  {
    id: 'train-on-data',
    question: 'Do you train on my data?',
    answer: [
      'No. Igris does not train foundation models on your data. Execution records, receipts, and fleet metadata are stored to operate the platform and give you audit visibility, not to build models.',
      'If you connect external model providers, their data handling depends on the provider and the account settings you choose with that provider. When Igris routes a request for inference, prompt content is sent only as needed for that provider to respond.',
      'For local runtime deployments, on-device adapter training (where configured) stays on device and does not involve Igris training foundation models on your content.',
    ],
    source: { href: DOCS_LINKS.dataPrivacy, label: 'Data Privacy' },
    category: 'deployment-security',
    tags: ['privacy', 'data'],
  },
  {
    id: 'security-controls',
    question: 'What security controls are available?',
    answer: [
      'Igris is designed around controlled execution. Before actions run, capability gates and policy boundaries define what a run is allowed to do. Tenant API keys scope programmatic access, and provider keys stored in the vault are encrypted before storage.',
      'During execution, violations and failure outcomes are recorded as part of the run rather than hidden. After execution, signed receipts and recovery evidence give your team material to review.',
      'Operator visibility is available through the console and API. Broader governance and audit options expand on higher tiers and private deployments, where retention, export, and security review needs are typically larger.',
    ],
    source: { href: DOCS_LINKS.security, label: 'Security' },
    category: 'deployment-security',
    tags: ['security'],
  },
]