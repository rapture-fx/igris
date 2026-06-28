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
      'Seed is the paid developer entry tier for validating recoverable agent actions, signed receipts, and task inspection. Teams evaluating Igris for production or private deployment can request a guided private preview.',
    category: 'getting-started',
    tags: ['seed', 'trial'],
  },
  {
    id: 'who-is-seed',
    question: 'Who is Seed for?',
    answer:
      'Seed is for individual builders testing one project, one execution environment, signed receipts, action evidence, and basic receipt verification.',
    category: 'getting-started',
    tags: ['seed', 'tier'],
  },
  {
    id: 'igris-vs-provider',
    question: 'How is Igris different from using OpenAI or Anthropic directly?',
    answer:
      'Direct provider calls are enough for simple chat or low-risk generation. Igris is for when agent output becomes real work: reading files, calling APIs, updating records, recovering from failure, and proving what happened afterward.',
    category: 'getting-started',
    tags: ['comparison', 'providers'],
  },
  {
    id: 'execution-environment',
    question: 'What is an execution environment?',
    answer:
      'An execution environment is a configured place where Igris can run or coordinate agent task execution, such as a hosted, local, or private deployment surface.',
    category: 'pricing-billing',
    tags: ['environment'],
  },
  {
    id: 'agent-task-run',
    question: 'What is an agent task run?',
    answer:
      'An agent task run is one submitted task executed through Igris. A run may include multiple committed actions, action evidence, signed receipts, and verification state.',
    category: 'pricing-billing',
    tags: ['task', 'run'],
  },
  {
    id: 'verified-task-run',
    question: 'What is a verified task run?',
    answer:
      'A verified task run is a completed run with inspectable execution metadata and a signed receipt that can be checked after execution.',
    category: 'pricing-billing',
    tags: ['verification'],
  },
  {
    id: 'model-inference-cost',
    question: 'Do I pay for model inference?',
    answer:
      'No. Igris pricing does not include provider inference costs. You bring your own provider keys or configured execution path, and provider usage is billed separately by the provider.',
    category: 'pricing-billing',
    tags: ['pricing', 'inference'],
  },
  {
    id: 'upgrade-downgrade',
    question: 'Can I upgrade or downgrade?',
    answer:
      'Yes. Plan changes can adjust project limits, execution environments, task volume, retention, and team access. Downgrades apply according to the billing cycle and current account state.',
    category: 'pricing-billing',
    tags: ['billing'],
  },
  {
    id: 'infinite-pricing',
    question: 'Why is Infinite custom priced?',
    answer:
      'Private deployment, retention, support, audit exports, and governance needs vary by team. Custom pricing lets the deployment scope match the operational requirements instead of forcing every advanced customer into one flat plan.',
    category: 'pricing-billing',
    tags: ['infinite', 'pricing'],
  },
  {
    id: 'what-verify',
    question: 'What does Igris verify?',
    answer:
      'Igris produces signed receipts and execution evidence for important task runs, so teams can inspect and verify what happened after execution. Verification behavior depends on the deployment surface and proof path used.',
    category: 'execution-verification',
    tags: ['verification', 'proof'],
  },
  {
    id: 'smarter-model',
    question: 'Does Igris make the model smarter?',
    answer:
      'No. Igris does not improve model intelligence or text quality. It makes agent execution more recoverable, inspectable, and verifiable once model output becomes work.',
    category: 'execution-verification',
    tags: ['models'],
  },
  {
    id: 'fallback',
    question: 'Does Igris handle fallback automatically?',
    answer:
      'Igris supports configured recovery and failure paths, but behavior depends on your deployment and proof setup. Recovery-sensitive behavior should be validated in your environment before production reliance.',
    category: 'execution-verification',
    tags: ['recovery', 'fallback'],
  },
  {
    id: 'without-dashboard',
    question: 'Can I use Igris without the dashboard?',
    answer:
      'Yes. Igris can be used through the API or SDK. The console adds operator visibility for task runs, action evidence, receipts, verification state, and account controls.',
    category: 'execution-verification',
    tags: ['api', 'console'],
  },
  {
    id: 'self-host',
    question: 'Can I self-host Igris?',
    answer:
      'Private deployment is available through Infinite. The exact deployment model, retention policy, support scope, and security requirements are defined during evaluation.',
    category: 'open-source',
    tags: ['self-host', 'private'],
  },
  {
    id: 'oss-vs-cloud',
    question: 'What is the difference between open source and Igris Cloud?',
    answer:
      'Open source gives you the runtime and core execution components to run Igris in your own environment. Igris Cloud adds the hosted control plane, managed execution surfaces, billing, team access, and operator console for teams that want a managed path.',
    category: 'open-source',
    tags: ['open-source', 'cloud'],
  },
  {
    id: 'cloud-data',
    question: 'Is my data sent to the cloud?',
    answer:
      'That depends on the execution surface you configure. Provider-backed execution sends requests to the selected provider. Local or private execution keeps work closer to the configured environment. Igris should be configured according to your data and security requirements.',
    category: 'deployment-security',
    tags: ['data', 'cloud'],
  },
  {
    id: 'train-on-data',
    question: 'Do you train on my data?',
    answer:
      'No. Igris does not train foundation models on your data. If you use external providers, their data handling depends on the provider and account settings you choose.',
    category: 'deployment-security',
    tags: ['privacy', 'data'],
  },
  {
    id: 'security-controls',
    question: 'What security controls are available?',
    answer:
      'Igris is designed around controlled execution, permission checks, signed receipts, recovery evidence, and operator visibility. Specific controls depend on the deployment mode and plan.',
    category: 'deployment-security',
    tags: ['security'],
  },
]