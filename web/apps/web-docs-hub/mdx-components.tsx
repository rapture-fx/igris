import { CodeBlock } from '@/components/CodeBlock';
import { DiagramTabs } from '@/components/DiagramTabs';
import { StepChain } from '@/components/StepChain';
import { Info, Warning, Danger, Tip, Success } from '@/components/Callout';

export function useMDXComponents(components: any): any {
  return {
    pre: (props: any) => <CodeBlock {...props} />,
    DiagramTabs,
    StepChain,
    Info,
    Warning,
    Danger,
    Tip,
    Success,
    ...components,
  };
}
