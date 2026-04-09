import defaultMdxComponents, { createRelativeLink } from 'fumadocs-ui/mdx';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { Heading } from 'fumadocs-ui/components/heading';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
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
    pre: ({ ref: _ref, className, ...props }) => (
      <CodeBlock
        {...props}
        className={['docs-code-block', className].filter(Boolean).join(' ')}
        viewportProps={{ className: 'text-[12.5px] md:text-[13px]' }}
      >
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    a: createRelativeLink(source, page),
    h1: ({ className, ...props }) => (
      <Heading
        as="h1"
        {...props}
        className={['text-[2rem] font-semibold tracking-tight md:text-[2.2rem]', className]
          .filter(Boolean)
          .join(' ')}
      />
    ),
    h2: ({ className, ...props }) => (
      <Heading
        as="h2"
        {...props}
        className={['text-[1.55rem] font-semibold tracking-tight md:text-[1.7rem]', className]
          .filter(Boolean)
          .join(' ')}
      />
    ),
    h3: ({ className, ...props }) => (
      <Heading
        as="h3"
        {...props}
        className={['text-[1.2rem] font-semibold tracking-tight md:text-[1.3rem]', className]
          .filter(Boolean)
          .join(' ')}
      />
    ),
    h4: ({ className, ...props }) => (
      <Heading
        as="h4"
        {...props}
        className={['text-[1rem] font-semibold tracking-tight', className].filter(Boolean).join(' ')}
      />
    ),
    h5: ({ className, ...props }) => (
      <Heading
        as="h5"
        {...props}
        className={['text-[0.9rem] font-semibold tracking-tight', className].filter(Boolean).join(' ')}
      />
    ),
    h6: ({ className, ...props }) => (
      <Heading
        as="h6"
        {...props}
        className={['text-[0.85rem] font-medium tracking-tight text-fd-muted-foreground', className]
          .filter(Boolean)
          .join(' ')}
      />
    ),
    img: (props) => <ImageZoom {...(props as React.ComponentProps<typeof ImageZoom>)} />,
    Tabs,
    Tab,
    TabsList,
    TabsTrigger,
    TabsContent,
    Steps,
    Step,
    TypeTable: (props) => (
      <div className="docs-type-table">
        <TypeTable {...props} />
      </div>
    ),
    InlineTOC: (props) => (
      <div className="docs-inline-toc">
        <InlineTOC {...props} />
      </div>
    ),
    Files,
    File,
    Folder,
    ...components,
  } satisfies MDXComponents;
}
