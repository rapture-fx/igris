import defaultMdxComponents, { createRelativeLink } from 'fumadocs-ui/mdx';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import type { Page } from 'fumadocs-core/source';
import type { LoaderOutput, LoaderConfig } from 'fumadocs-core/source';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(
  source: LoaderOutput<LoaderConfig>,
  page: Page,
  components?: MDXComponents,
): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    a: createRelativeLink(source, page),
    Tabs,
    Tab,
    TabsList,
    TabsTrigger,
    TabsContent,
    Steps,
    Step,
    TypeTable,
    Files,
    File,
    Folder,
    ...components,
  } satisfies MDXComponents;
}
