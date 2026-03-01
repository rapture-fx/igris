import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    endpoint: string;
  }>;
}

// Map endpoint slugs to their corresponding MDX files
const endpointToFile: Record<string, string> = {
  'chat-completions': 'chat-completions',
  models: 'models',
  embeddings: 'embeddings',
  status: 'status',
  health: 'health',
  metrics: 'metrics',
  'lora-status': 'lora-status',
};

export async function generateStaticParams() {
  return Object.keys(endpointToFile).map((endpoint) => ({
    endpoint,
  }));
}

export default async function EndpointPage({ params }: PageProps) {
  const { endpoint } = await params;
  const fileName = endpointToFile[endpoint];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/api-reference/endpoints/${fileName}.mdx`)).default;
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
