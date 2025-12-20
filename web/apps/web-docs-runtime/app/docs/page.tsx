import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import Introduction from '@/docs/introduction.mdx';

export default function DocsPage() {
  return (
    <DocsLayout>
      <MDXContent>
        <Introduction />
      </MDXContent>
    </DocsLayout>
  );
}
