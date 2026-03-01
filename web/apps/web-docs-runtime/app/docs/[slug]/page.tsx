import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Map slugs to their corresponding MDX files
const slugToFile: Record<string, string> = {
  quickstart: 'quickstart',
  'providers-keys': 'providers-keys',
  'routing-policies': 'routing-policies',
  api: 'api-reference',
  'sdk-usage': 'sdk-usage',
  architecture: 'architecture',
  'multi-tenancy': 'multi-tenancy',
  observability: 'observability',
  pricing: 'pricing-tiers',
  faq: 'faq',
  changelog: 'changelog',
  'fleet-management': 'fleet-management',
  'ros2-integration': 'ros2-integration',
  multimodal: 'multimodal',
  'qlora-training': 'qlora-training',
  'local-models': 'local-models',
  deployment: 'deployment',
  configuration: 'configuration',
  'hybrid-execution': 'hybrid-execution',
};

export async function generateStaticParams() {
  return Object.keys(slugToFile).map((slug) => ({
    slug,
  }));
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const fileName = slugToFile[slug];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/${fileName}.mdx`)).default;
  } catch (error) {
    notFound();
  }

  return (
    <DocsLayout>
      <MDXContent>
        <MDXComponent />
      </MDXContent>
    </DocsLayout>
  );
}
