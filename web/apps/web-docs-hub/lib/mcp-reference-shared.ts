import mcpReference from '@/lib/generated/mcp-reference.json';

export type McpGuide = {
  slug: string;
  title: string;
  href: string;
  summary: string;
};

export type McpMethod = {
  name: string;
  kind: 'transport' | 'method';
  page: string;
  summary: string;
};

export type McpMethodGroup = {
  title: string;
  summary: string;
  methods: McpMethod[];
};

export type McpPageSection = {
  id: string;
  label: string;
};

export const mcpOverview = mcpReference.overview as {
  title: string;
  summary: string;
};

export const mcpGuides = mcpReference.guides as McpGuide[];
export const mcpMethodGroups = mcpReference.methodGroups as McpMethodGroup[];

const mcpPageSections: Record<string, McpPageSection[]> = {
  mcp: [
    { id: 'overview', label: 'Overview' },
    { id: 'guides', label: 'Guide Pages' },
    { id: 'transport-surfaces', label: 'Transport Surfaces' },
    { id: 'method-families', label: 'Method Families' },
  ],
  'mcp-server': [
    { id: 'what-the-mcp-server-is-for', label: 'What The MCP Server Is For' },
    { id: 'customer-contract', label: 'Customer Contract' },
    { id: 'request-shape', label: 'Request Shape' },
    { id: 'core-method-families', label: 'Core Method Families' },
    { id: 'integration-guidance', label: 'Integration Guidance' },
  ],
  'mcp-swarm': [
    { id: 'what-it-solves', label: 'What It Solves' },
    { id: 'operational-model', label: 'Operational Model' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'design-boundaries', label: 'Design Boundaries' },
    { id: 'common-mistakes', label: 'Common Mistakes' },
  ],
  'mcp-integration-patterns': [
    { id: 'pattern-separate-working-context-from-audit-data', label: 'Working Context vs Audit' },
    { id: 'pattern-give-shared-context-a-schema', label: 'Give Shared Context A Schema' },
    { id: 'pattern-pair-mcp-with-durable-tasks-deliberately', label: 'MCP With Durable Tasks' },
    { id: 'pattern-keep-the-product-boundary-clean', label: 'Keep The Product Boundary Clean' },
  ],
};

export function getMcpPageSections(slug: string) {
  return mcpPageSections[slug] ?? [];
}
