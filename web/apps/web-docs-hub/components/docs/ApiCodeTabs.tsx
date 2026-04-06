import {
  CodeBlock,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  Pre,
} from 'fumadocs-ui/components/codeblock';
import type { ApiCodeSample } from '@/lib/api-reference';

interface ApiCodeTabsProps {
  samples: ApiCodeSample[];
}

export function ApiCodeTabs({ samples }: ApiCodeTabsProps) {
  if (samples.length === 0) {
    return null;
  }

  return (
    <CodeBlockTabs defaultValue={samples[0]?.label}>
      <CodeBlockTabsList>
        {samples.map((sample) => (
          <CodeBlockTabsTrigger key={sample.label} value={sample.label}>
            {sample.label}
          </CodeBlockTabsTrigger>
        ))}
      </CodeBlockTabsList>
      {samples.map((sample) => (
        <CodeBlockTab key={sample.label} value={sample.label}>
          <CodeBlock title={sample.language}>
            <Pre>
              <code>{sample.code}</code>
            </Pre>
          </CodeBlock>
        </CodeBlockTab>
      ))}
    </CodeBlockTabs>
  );
}
