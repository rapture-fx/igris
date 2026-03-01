import { CodeBlock } from '@/components/CodeBlock';

export function useMDXComponents(components: any): any {
  return {
    pre: (props: any) => <CodeBlock {...props} />,
    ...components,
  };
}
