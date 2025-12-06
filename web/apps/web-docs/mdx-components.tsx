import { Tab, Tabs } from '@/components/Tabs';
import { CopyPageButton } from '@/components/CopyPageButton';
import { EndpointBlock } from '@/components/EndpointBlock';

export function useMDXComponents(components: any): any {
  return {
    Tab,
    Tabs,
    EndpointBlock,
    h1: (props: any) => (
      <div className="relative">
        <h1 {...props} />
        <div className="absolute top-0 right-0">
          <CopyPageButton />
        </div>
      </div>
    ),
    ...components,
  };
}
