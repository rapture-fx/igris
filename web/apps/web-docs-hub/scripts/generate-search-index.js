const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../content/docs');
const outputFile = path.join(__dirname, '../lib/search-index.json');
const staticSearchFile = path.join(__dirname, '../public/search-static.json');
const generatedApiFile = path.join(__dirname, '../lib/generated/api-reference.json');
const generatedSdkFile = path.join(__dirname, '../lib/generated/sdk-support.json');
const hiddenDocPaths = new Set([
  'docs-authoring',
  'docs-authoring-components',
  'docs-authoring-schemas',
]);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!match) {
    return { body: content, data: {} };
  }

  const data = {};
  for (const line of match[1].split('\n')) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!keyMatch) continue;
    const [, key, rawValue] = keyMatch;
    data[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }

  return {
    body: content.slice(match[0].length),
    data,
  };
}

function collectMdxFiles(dir, relativeDir = '', files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const absolutePath = path.join(dir, entry.name);
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      collectMdxFiles(absolutePath, relativePath, files);
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      files.push(relativePath);
    }
  }

  return files;
}

function toDocPath(relativePath) {
  const withoutExtension = relativePath.replace(/\.mdx$/, '');

  if (withoutExtension === 'index') return '/docs';
  if (withoutExtension.endsWith('/index')) {
    return `/docs/${withoutExtension.slice(0, -'/index'.length)}`;
  }

  return `/docs/${withoutExtension}`;
}

function humanizeSlug(slug) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildBreadcrumbMap() {
  const breadcrumbs = {};

  function walkMeta(relativeDir = '', ancestors = []) {
    const metaPath = path.join(docsDir, relativeDir, 'meta.json');
    if (!fs.existsSync(metaPath)) return;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    let currentSection = '';

    for (const item of meta.pages || []) {
      if (typeof item !== 'string') continue;

      const separatorMatch = item.match(/^---(.+)---$/);
      if (separatorMatch) {
        currentSection = separatorMatch[1].trim();
        continue;
      }

      const pageKey = relativeDir ? `${relativeDir}/${item}` : item;
      const childDir = path.join(docsDir, pageKey);
      const crumbs = [...ancestors];

      if (currentSection) {
        crumbs.push(currentSection);
      } else if (relativeDir && meta.title && crumbs[crumbs.length - 1] !== meta.title) {
        crumbs.push(meta.title);
      }

      breadcrumbs[pageKey] = crumbs;

      if (fs.existsSync(childDir) && fs.statSync(childDir).isDirectory()) {
        walkMeta(pageKey, crumbs);
      }
    }
  }

  walkMeta();
  return breadcrumbs;
}

function extractSearchableText(body) {
  return body
    .replace(/^import\s.+;$/gm, '')
    .replace(/^export\s.+;$/gm, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ' '))
    .replace(/<[^>\n]+>/g, ' ')
    .replace(/\{[^}\n]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function upsertEntry(map, entry) {
  const current = map.get(entry.path);
  if (!current) {
    map.set(entry.path, entry);
    return;
  }

  map.set(entry.path, {
    ...current,
    ...entry,
    description: entry.description || current.description,
    content: [current.content, entry.content].filter(Boolean).join(' ').trim(),
    keywords: [current.keywords, entry.keywords].filter(Boolean).join(' ').trim().slice(0, 2000),
    breadcrumbs: entry.breadcrumbs?.length ? entry.breadcrumbs : current.breadcrumbs,
  });
}

async function writeStaticSearchDatabase(index) {
  const { createSearchAPI } = await import('fumadocs-core/search/server');
  const searchApi = createSearchAPI('simple', {
    indexes: index.map((entry) => ({
      title: entry.title,
      description: entry.description || '',
      breadcrumbs: entry.breadcrumbs || [],
      content: entry.content || entry.keywords || entry.title,
      url: entry.path,
      keywords: entry.keywords || '',
    })),
  });

  const exported = await searchApi.export();
  fs.writeFileSync(staticSearchFile, JSON.stringify(exported));
}

async function extractSearchIndex() {
  const files = collectMdxFiles(docsDir);
  const breadcrumbMap = buildBreadcrumbMap();
  const index = new Map();

  for (const relativePath of files) {
    const filePath = path.join(docsDir, relativePath);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const { body, data } = parseFrontmatter(rawContent);
    const pageKey = relativePath.replace(/\.mdx$/, '');
    if (hiddenDocPaths.has(pageKey)) continue;
    const slug = pageKey.split('/').pop() || 'index';
    const searchableText = extractSearchableText(body);

    const headings = body
      .split('\n')
      .filter((line) => /^#{1,3}\s/.test(line))
      .map((line) => line.replace(/^#+\s/, '').trim())
      .join(' ');

    const codeLangs = [...body.matchAll(/```(\w+)/g)]
      .map((match) => match[1])
      .join(' ');

    const firstParagraph = searchableText.slice(0, 220);
    const title = data.title || humanizeSlug(slug);

    upsertEntry(index, {
      title,
      path: toDocPath(relativePath),
      description: data.description || data.summary || firstParagraph,
      content: `${headings} ${searchableText.slice(0, 2400)}`.trim(),
      breadcrumbs: breadcrumbMap[pageKey] || [],
      keywords: `${title} ${pageKey} ${headings} ${codeLangs} ${searchableText.slice(0, 1200)}`
        .toLowerCase()
        .slice(0, 2000),
    });
  }

  if (fs.existsSync(generatedApiFile)) {
    const apiReference = JSON.parse(fs.readFileSync(generatedApiFile, 'utf-8'));

    [
      {
        title: 'API Introduction',
        path: '/docs/api-reference/introduction',
        description: 'Overview of the customer API contract.',
        content: 'API introduction base URL surfaces overview contract',
        breadcrumbs: ['Reference', 'API Reference'],
        keywords: 'api introduction base url surfaces overview contract',
      },
      {
        title: 'API Authentication',
        path: '/docs/api-reference/authentication',
        description: 'Authentication models for cloud and local API use.',
        content: 'API authentication bearer api key session cookie runtime auth',
        breadcrumbs: ['Reference', 'API Reference'],
        keywords: 'api authentication bearer api key session cookie runtime auth',
      },
      {
        title: 'API Errors',
        path: '/docs/api-reference/errors',
        description: 'Error handling and common response codes.',
        content: 'API errors error codes invalid request unauthorized internal error',
        breadcrumbs: ['Reference', 'API Reference'],
        keywords: 'api errors error codes invalid request unauthorized internal error',
      },
      {
        title: 'API Rate Limits',
        path: '/docs/api-reference/rate-limits',
        description: 'Rate limit behavior and retry expectations.',
        content: 'API rate limits retry-after 429 throttle',
        breadcrumbs: ['Reference', 'API Reference'],
        keywords: 'api rate limits retry-after 429 throttle',
      },
    ].forEach((entry) => upsertEntry(index, entry));

    for (const section of apiReference.sections || []) {
      const sectionSlug = slugify(section.title);

      for (const endpoint of section.endpoints || []) {
        const endpointSlug = slugify(
          `${endpoint.method.toLowerCase()}-${endpoint.path.replace(/:/g, '').replace(/\//g, '-')}`,
        );

        upsertEntry(index, {
          title: `${endpoint.method} ${endpoint.path}`,
          path: `/docs/api-reference/${sectionSlug}/${endpointSlug}`,
          description: endpoint.description,
          content: `${endpoint.method} ${endpoint.path} ${endpoint.description}`.trim(),
          breadcrumbs: ['Reference', 'API Reference', section.title],
          keywords: `${section.title} ${endpoint.method} ${endpoint.path} ${endpoint.description} ${endpoint.auth} ${endpoint.surface}`
            .toLowerCase()
            .slice(0, 2000),
        });
      }
    }
  }

  if (fs.existsSync(generatedSdkFile)) {
    const sdkSupport = JSON.parse(fs.readFileSync(generatedSdkFile, 'utf-8'));

    for (const row of sdkSupport.rows || []) {
      upsertEntry(index, {
        title: `${row.language} SDK`,
        path: '/docs/sdk',
        description: row.notes,
        content: `${row.language} ${row.status} ${row.notes}`.trim(),
        breadcrumbs: ['Getting Started'],
        keywords: `${row.language} ${row.status} ${row.package} ${row.install} ${row.notes}`
          .toLowerCase()
          .slice(0, 2000),
      });
    }
  }

  const entries = [...index.values()].sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(outputFile, JSON.stringify(entries, null, 2));
  await writeStaticSearchDatabase(entries);

  console.log(`Search index generated: ${entries.length} entries → ${outputFile}`);
  console.log(`Static search database generated → ${staticSearchFile}`);
}

extractSearchIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
