import type { Folder, Node, Root } from 'fumadocs-core/page-tree';

const hiddenReferenceNames = new Set([
  'API Reference',
  'Documentation Roadmap',
  'Troubleshooting',
  'Upgrade & Migration',
  'Changelog',
]);

function cloneNode(node: Node): Node {
  if (node.type === 'folder') {
    return {
      ...node,
      index: node.index ? { ...node.index } : undefined,
      children: node.children.map(cloneNode),
    };
  }

  return { ...node };
}

export function createSidebarTree(tree: Root): Root {
  const cloned: Root = {
    ...tree,
    children: tree.children.map(cloneNode),
    fallback: tree.fallback
      ? {
          ...tree.fallback,
          children: tree.fallback.children.map(cloneNode),
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
