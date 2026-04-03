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
        name: 'Igris Documentation',
        description: 'Documentation for the Igris product surface: Overture cloud coordination, igris-runtime, fleet operations, receipts, and SDKs.',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows, ARM',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
        url: 'https://docs.igrisinertial.com/docs/',
        featureList: [
          'OpenAI-compatible cloud API',
          'Runtime distribution and fleet operations',
          'Signed execution receipts and proof endpoints',
          'Local GGUF model inference',
          'First-class SDK documentation',
          'Policy and governance documentation',
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
