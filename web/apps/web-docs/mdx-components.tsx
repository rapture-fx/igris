import { Tab, Tabs } from '@/components/Tabs';

export function useMDXComponents(components: any): any {
  return {
    Tab,
    Tabs,
    ...components,
  };
}
