import defaultMdxComponents, { createRelativeLink } from 'fumadocs-ui/mdx';
import { createFileSystemGeneratorCache, createGenerator } from 'fumadocs-typescript';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import type { Page } from 'fumadocs-core/source';
import type { LoaderOutput, LoaderConfig } from 'fumadocs-core/source';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';

interface AutoTypeTableProps extends ComponentProps<'div'> {
  path?: string;
  name?: string;
  type?: string;
}

const typeGenerator = createGenerator({
  cache: createFileSystemGeneratorCache('.next/fumadocs-typescript'),
});

function parseTagText(text: string): string {
  return text.trim().replace(/^`|`$/g, '');
}

function parseParamTag(text: string): { name: string; description: string } {
  const [name, ...rest] = text.split(' - ');

  return {
    name: name.trim(),
    description: rest.join(' - ').trim(),
  };
}

async function AutoTypeTable({ path, name, type, ...props }: AutoTypeTableProps) {
  const docs = await typeGenerator.generateTypeTable({ path, name, type });

  return (
    <>
      {docs.map((doc) => {
        const entries = Object.fromEntries(
          doc.entries.map((entry) => {
            const defaultTag = entry.tags.find((tag) => tag.name === 'default');
            const returnsTag = entry.tags.find((tag) => tag.name === 'returns');
            const paramTags = entry.tags.filter((tag) => tag.name === 'param');

            return [
              entry.name,
              {
                type: entry.simplifiedType,
                typeDescription: entry.type,
                typeDescriptionLink: entry.typeHref,
                description: entry.description,
                default: defaultTag ? parseTagText(defaultTag.text) : undefined,
                parameters: paramTags.map((tag) => parseParamTag(tag.text)),
                required: entry.required,
                deprecated: entry.deprecated,
                returns: returnsTag ? parseTagText(returnsTag.text) : undefined,
              },
            ];
          }),
        );

        return <TypeTable key={doc.id} {...props} type={entries} />;
      })}
    </>
  );
}

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
    img: (props) => <ImageZoom {...(props as React.ComponentProps<typeof ImageZoom>)} />,
    Tabs,
    Tab,
    TabsList,
    TabsTrigger,
    TabsContent,
    Steps,
    Step,
    TypeTable,
    AutoTypeTable,
    InlineTOC,
    Files,
    File,
    Folder,
    ...components,
  } satisfies MDXComponents;
}
