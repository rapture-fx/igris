import type { Folder, Node, Root } from 'fumadocs-core/page-tree';

const hiddenReferenceNames = new Set([
  'Overview',
  'API Reference',
  'Documentation Roadmap',
  'Troubleshooting',
  'Upgrade & Migration',
  'Changelog',
]);

function cloneNode(node: Node, isPageVisible: (url: string) => boolean): Node | null {
  if (node.type === 'page') {
    return isPageVisible(node.url) ? { ...node } : null;
  }

  if (node.type === 'folder') {
    const children = node.children
      .map((child) => cloneNode(child, isPageVisible))
      .filter((child): child is Node => child !== null);
    const index = node.index && isPageVisible(node.index.url) ? { ...node.index } : undefined;

    if (!index && children.length === 0) {
      return null;
    }

    return {
      ...node,
      index,
      children,
    };
  }

  return { ...node };
}

export function createSidebarTree(tree: Root, isPageVisible: (url: string) => boolean): Root {
  const cloned: Root = {
    ...tree,
    children: tree.children
      .map((node) => cloneNode(node, isPageVisible))
      .filter((node): node is Node => node !== null),
    fallback: tree.fallback
      ? {
          ...tree.fallback,
          children: tree.fallback.children
            .map((node) => cloneNode(node, isPageVisible))
            .filter((node): node is Node => node !== null),
        }
      : undefined,
  };

  cloned.children = cloned.children.filter((node) => {
    if (node.type === 'separator') {
      return node.name !== 'Reference';
    }

    if (typeof node.name === 'string' && hiddenReferenceNames.has(node.name)) {
      return false;
    }

    return true;
  });

  return cloned;
}
