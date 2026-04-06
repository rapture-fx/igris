import { StepChain } from './StepChain';
import { Info, Warning, Danger, Tip, Success } from './Callout';
import { DiagramTabs } from './DiagramTabs';

/**
 * MDX component map for Fumadocs-rendered pages.
 * Pass this to <MDX components={fumadocsMdxComponents} /> in docs pages.
 */
export const fumadocsMdxComponents = {
  StepChain,
  DiagramTabs,
  Info,
  Warning,
  Danger,
  Tip,
  Success,
};
