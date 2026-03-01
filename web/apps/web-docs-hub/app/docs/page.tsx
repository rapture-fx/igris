import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import Overview from '@/docs/overview.mdx';

export default function DocsPage() {
  return (
    <DocsLayout>
      <MDXContent>
        <Overview />
      </MDXContent>
    </DocsLayout>
  );
}
