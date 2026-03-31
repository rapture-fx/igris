import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { JsonLd } from '@/components/JsonLd';
import { DocFooter } from '@/components/layout/DocFooter';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';
import Overview from '@/docs/overview.mdx';

export default function DocsPage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Igris Runtime',
        description: 'A 16MB secure, governed AI execution runtime for agents, inference, and robotics. Bounded execution with verifiable traces, deterministic behavior, and local fallback.',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows, ARM',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
        url: 'https://docs.igrisinertial.com/docs/',
        featureList: [
          'Bounded execution with resource limits',
          'Verifiable traces and execution receipts',
          'Local GGUF model inference',
          'Cloud API routing via Overture',
          'Fleet management and OTA updates',
          'OS-level sandboxed containment',
        ],
      }} />
      <DocsLayout>
        <MDXContent>
          <Overview />
        </MDXContent>
        <FeedbackWidget />
        <DocFooter slug="overview" />
      </DocsLayout>
    </>
  );
}
