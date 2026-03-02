import { CodeBlock } from '@/components/CodeBlock';
import { DiagramTabs } from '@/components/DiagramTabs';
import { StepChain } from '@/components/StepChain';

export function useMDXComponents(components: any): any {
  return {
    pre: (props: any) => <CodeBlock {...props} />,
    DiagramTabs,
    StepChain,
    ...components,
  };
}
