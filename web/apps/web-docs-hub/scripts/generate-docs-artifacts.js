const fs = require('fs');
const path = require('path');

const { apiSections, generatedDir, mcpReference, repoRoot, sdkSupport } = require('./docs-data');
const { getDocsAudienceMode, isContentVisible, parseFrontmatter } = require('./docs-audience');
const { generateApiReferenceContent } = require('./generate-api-reference-content');
const docsRoot = path.join(__dirname, '../content/docs');
const publicMarkdownDir = path.join(__dirname, '../public/markdown');

function walk(dir, extension, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'out') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, extension, files);
    } else if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

function joinRoute(base, routePath) {
  const normalized = `${base}${routePath}`.replace(/\/+/g, '/');
  if (normalized === '') {
    return '/';
  }
  return normalized !== '/' && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function canonicalRoutePath(routePath) {
  return routePath.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
}

function extractGoRoutes(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const prefixes = new Map([['app', '']]);
  let changed = true;

  while (changed) {
    changed = false;
    const groupRegex = /(\w+)\s*:=\s*(\w+)\.Group\("([^"]*)"/g;
    let match;
    while ((match = groupRegex.exec(source)) !== null) {
      const [, name, baseName, suffix] = match;
      if (!prefixes.has(baseName)) {
        continue;
      }
      const value = joinRoute(prefixes.get(baseName), suffix);
      if (prefixes.get(name) !== value) {
        prefixes.set(name, value);
        changed = true;
      }
    }
  }

  const routes = [];
  const routeRegex = /(\w+)\.(Get|Post|Put|Patch|Delete)\("([^"]*)"/g;
  let match;
  while ((match = routeRegex.exec(source)) !== null) {
    const [, baseName, method, suffix] = match;
    const base = prefixes.get(baseName);
    if (base === undefined) {
      continue;
    }
    routes.push({
      method: method.toUpperCase(),
      path: joinRoute(base, suffix),
      file: filePath,
    });
  }

  return routes;
}

function extractRustRoutes(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const routes = [];
  const routeRegex = /\.route\(\s*"([^"]+)",\s*(get|post|put|patch|delete)\(/g;
  let match;
  while ((match = routeRegex.exec(source)) !== null) {
    routes.push({
      method: match[2].toUpperCase(),
      path: match[1],
      file: filePath,
    });
  }
  return routes;
}

function buildRouteInventory() {
  const goFiles = walk(path.join(repoRoot, 'igris-overture', 'api'), '.go');
  const rustFiles = [
    path.join(repoRoot, 'igris-runtime', 'crates', 'igris-server', 'src', 'main.rs'),
  ];

  const inventory = [];
  for (const filePath of goFiles) {
    inventory.push(...extractGoRoutes(filePath));
  }
  for (const filePath of rustFiles) {
    inventory.push(...extractRustRoutes(filePath));
  }

  return inventory;
}

function validateConfiguredRoutes(inventory) {
  const routeKeys = new Set(inventory.map((route) => `${route.method} ${canonicalRoutePath(route.path)}`));
  const missing = [];
  const metadataFailures = [];

  for (const section of apiSections) {
    for (const endpoint of section.endpoints) {
      const key = `${endpoint.method} ${canonicalRoutePath(endpoint.path)}`;
      if (!routeKeys.has(key)) {
        missing.push(`${endpoint.method} ${endpoint.path}`);
      }
      if (!endpoint.support) {
        metadataFailures.push(`${key}: missing support level`);
      }
      if (!endpoint.deployment) {
        metadataFailures.push(`${key}: missing deployment mode`);
      }
      if (!endpoint.audience) {
        metadataFailures.push(`${key}: missing audience`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Docs route catalog references routes not found in code:\n${missing.join('\n')}`);
  }

  if (metadataFailures.length > 0) {
    throw new Error(`Docs route catalog is missing endpoint metadata:\n${metadataFailures.join('\n')}`);
  }
}

function writeJson(fileName, data) {
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(path.join(generatedDir, fileName), `${JSON.stringify(data, null, 2)}\n`);
}

function toDocUrl(relativePath) {
  const withoutExtension = relativePath.replace(/\.mdx$/, '');

  if (withoutExtension === 'index') {
    return '/docs';
  }
  if (withoutExtension.endsWith('/index')) {
    return `/docs/${withoutExtension.slice(0, -'/index'.length)}`;
  }

  return `/docs/${withoutExtension}`;
}

function writeDocsAudienceMap() {
  const pages = {};
  const markdownFiles = walk(docsRoot, '.mdx');

  for (const filePath of markdownFiles) {
    const relativePath = path.relative(docsRoot, filePath).replaceAll(path.sep, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const { data } = parseFrontmatter(content);
    pages[toDocUrl(relativePath)] = data.audience || 'public';
  }

  writeJson('docs-audience.json', {
    generated_at: new Date().toISOString(),
    pages,
  });
}

function mirrorMarkdownSources() {
  const markdownFiles = walk(docsRoot, '.mdx');
  const audienceMode = getDocsAudienceMode();
  fs.rmSync(publicMarkdownDir, { recursive: true, force: true });

  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!isContentVisible(content, audienceMode)) {
      continue;
    }

    const relativePath = path.relative(docsRoot, filePath);
    const outputPath = path.join(publicMarkdownDir, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
  }
}

function main() {
  const inventory = buildRouteInventory();
  validateConfiguredRoutes(inventory);

  const generatedAt = new Date().toISOString();

  writeJson('api-reference.json', {
    generated_at: generatedAt,
    generated_from: ['igris-overture/api/*.go', 'igris-runtime/crates/igris-server/src/main.rs'],
    route_inventory_count: inventory.length,
    sections: apiSections,
  });

  writeJson('sdk-support.json', {
    ...sdkSupport,
    generated_at: generatedAt,
  });

  writeJson('mcp-reference.json', {
    ...mcpReference,
    generated_at: generatedAt,
  });

  generateApiReferenceContent();
  writeDocsAudienceMap();
  mirrorMarkdownSources();

  console.log(`Generated docs artifacts in ${generatedDir}`);
}

main();
