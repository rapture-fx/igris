const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('../node_modules/typescript');
const { apiSections, docsAppRoot } = require('./docs-data');

const apiReferenceDir = path.join(docsAppRoot, 'content', 'docs', 'api-reference');

const apiGuides = [
  {
    slug: 'introduction',
    title: 'Introduction',
    summary:
      'How the Igris API reference is organized, when to use each access point, and how to move from guides into endpoint-level integration work.',
    sections: [
      {
        title: 'Two Product Surfaces',
        paragraphs: [
          'Igris is documented here as one product with two access points. Use the hosted API at `https://overture.igrisinertial.com` when your integration needs account, fleet, billing, receipt, or policy capabilities. Use the local runtime API at `http://localhost:8080` by default when the request belongs on the machine where Igris is running.',
          'This split is about where the request executes, not about two different products. The API reference groups endpoints by capability so you can navigate by task first and only think about the base URL when you are ready to make the call.',
        ],
      },
      {
        title: 'How Endpoint Pages Work',
        paragraphs: [
          'Every endpoint has its own page. That page tells you what the route is for, which authentication model it expects, the path and query parameters it accepts, the request body fields that matter, and the status codes you should plan for in a real client.',
          'Use the overview page to browse by capability, then switch to endpoint pages when you are implementing or debugging a specific call.',
        ],
      },
      {
        title: 'SDK Guidance',
        paragraphs: [
          'JavaScript, Go, and Rust are the first-class SDK languages today. When an endpoint is covered by a native SDK, prefer that SDK for application code because it gives you a cleaner call surface and reduces request-shape drift over time.',
          'Some management routes are still best treated as direct HTTP integrations. In those cases, the endpoint page is the primary contract: use the request and response examples, confirm the authentication model, and wire your own client behavior around the listed status codes.',
        ],
      },
      {
        title: 'Support Labels and Deployment Modes',
        paragraphs: [
          'Each endpoint page carries both a support label and a deployment mode. **Core** routes are the primary customer contract. **Supported** routes are part of the shipped product surface but may not be the first endpoint a new customer should start with. **Preview** routes are available, but they should be adopted deliberately.',
          'Deployment mode tells you where the route belongs operationally. **Cloud** routes are served by the hosted API, **Local** routes are served by `igris-runtime`, and **Hybrid** routes are used when the hosted product and one or more runtimes are working together.',
        ],
      },
    ],
    codeTitle: 'Base URLs',
    code: `Cloud API
https://overture.igrisinertial.com

Local runtime
http://localhost:8080`,
    responseTitle: 'Example JSON',
    response: `{
  "surface": "cloud",
  "supports": [
    "routing",
    "billing",
    "receipts",
    "fleet coordination"
  ]
}`,
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    summary:
      'Which credentials belong to automation, browser sessions, and runtime-local deployments, and how to choose the right one for each route.',
    sections: [
      {
        title: 'Tenant API Keys',
        paragraphs: [
          'Customer automation should use tenant API keys with the `igris_` prefix. These keys are the default credential for server-side integrations, CI jobs, backend workers, and any script that is calling the hosted API outside the browser.',
          'Supply the key as `Authorization: Bearer ...` or `X-API-Key` if the endpoint allows it. Endpoint pages call out the expected model explicitly, so treat the endpoint page as authoritative over any generic assumption.',
        ],
      },
      {
        title: 'Session Cookies',
        paragraphs: [
          'Browser-driven console workflows use session cookies. These routes are designed for an authenticated user session rather than headless automation, so they should not be treated as generic bearer-token endpoints unless the endpoint page says an API key is also accepted.',
          'If you are building automation, prefer routes that are documented with API-key access.',
        ],
      },
      {
        title: 'Runtime-local Auth',
        paragraphs: [
          'The local runtime API follows the runtime `auth` configuration. Some deployments intentionally keep that surface inside a trusted network boundary with minimal local auth, while others front it with stricter controls.',
          'Because that access model depends on deployment, do not assume that a local runtime route behaves like the hosted API.',
        ],
      },
      {
        title: 'Choosing a Credential',
        paragraphs: [
          'Use tenant API keys for server-to-server automation. Use session cookies for browser experiences that are already inside the Igris console. Use runtime-local authentication only when the endpoint is explicitly local and you control the deployment boundary.',
        ],
      },
    ],
    codeTitle: 'Bearer Example',
    code: `curl -H "Authorization: Bearer $IGRIS_API_KEY" \\
  https://overture.igrisinertial.com/v1/models`,
    responseTitle: 'Example JSON',
    response: `{
  "error": "unauthorized",
  "code": "INVALID_API_KEY"
}`,
  },
  {
    slug: 'errors',
    title: 'Errors',
    summary:
      'How to read error responses across the API reference and what to expect from validation, authentication, throttling, and server failures.',
    sections: [
      {
        title: 'Status Codes',
        paragraphs: [
          'The HTTP status code tells you what class of failure happened before you look at the JSON body. Treat 4xx responses as request, authentication, or access problems that your client should handle directly, and treat 5xx responses as server-side failures that may require retry, fallback, or operator attention.',
          'The most common patterns are 400 for invalid request shape, 401 for missing or invalid credentials, 403 for an authenticated request that still is not allowed, 404 when the addressed resource does not exist, 429 when throttling is applied, and 500-level codes when the server cannot complete a valid request.',
        ],
      },
      {
        title: 'Validation Errors',
        paragraphs: [
          'Validation failures usually mean the request shape was wrong for the route you called. Many handlers return a compact JSON envelope with `error` and sometimes a more specific `message` or `code` value that tells you what part of the request could not be accepted.',
        ],
      },
      {
        title: 'Authentication Failures',
        paragraphs: [
          'Authentication failures typically return HTTP 401. Session-based handlers often use codes such as `MISSING_SESSION` or `INVALID_SESSION`, while API-key handlers more commonly return `INVALID_API_KEY`.',
        ],
      },
      {
        title: 'Server Errors',
        paragraphs: [
          'Server-side failures commonly return a generic error such as `internal_error` or a route-specific code such as `registration_failed` or `STORAGE_FAILED`. These responses indicate that the server accepted the route contract but could not complete the operation.',
        ],
      },
      {
        title: 'Handling Strategy',
        paragraphs: [
          'Good clients do not handle every error the same way. Fix the request for 400-class validation issues, refresh or replace credentials for 401 responses, stop and inspect authorization assumptions on 403 responses, and apply controlled retry or fallback only for the routes and statuses that are documented as retry-safe.',
        ],
      },
    ],
    codeTitle: 'Error Envelope',
    code: `{
  "error": "invalid_request",
  "message": "Failed to parse request body"
}`,
    responseTitle: 'Example JSON',
    response: `{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "retry_after_seconds": 60
}`,
    statusCodes: [
      { code: 400, title: 'Bad Request', description: 'The route was reached, but the request body, query, or path data did not match the endpoint contract.' },
      { code: 401, title: 'Unauthorized', description: 'Credentials were missing, expired, malformed, or not accepted by this route.' },
      { code: 403, title: 'Forbidden', description: 'The caller is authenticated, but the action or resource is not allowed for that identity.' },
      { code: 404, title: 'Not Found', description: 'The addressed resource or route target does not exist in the current tenant or runtime context.' },
      { code: 429, title: 'Too Many Requests', description: 'The caller exceeded the current throttle window and should wait before retrying.' },
      { code: 500, title: 'Internal Server Error', description: 'The server accepted the request contract but failed while processing it.' },
    ],
  },
  {
    slug: 'rate-limits',
    title: 'Rate Limits',
    summary:
      'What throttling exists today, where it applies, and how clients should behave when they receive a 429 response.',
    sections: [
      {
        title: 'Global Control-plane Limit',
        paragraphs: [
          'The hosted API currently applies a default limiter of 100 requests per minute. Endpoint pages call out the exceptions that matter more than the global default.',
          'Response headers are only guaranteed on the 429 path right now. Clients should not assume that every successful response carries full rate-limit metadata.',
        ],
      },
      {
        title: 'Runtime Download Limit',
        paragraphs: [
          'Runtime download endpoints use a tighter subscription-aware throttle. Treat binary download as a provisioning or rollout action, not as a hot-path request that your application makes repeatedly during normal traffic.',
        ],
      },
      {
        title: 'Client Behavior',
        paragraphs: [
          'Build clients so that a 429 is expected and handled, not treated as an exceptional edge case. Honor `Retry-After` when it is present, apply backoff with jitter for repeated retries, and avoid running parallel request bursts that all wake up at the same second.',
        ],
      },
    ],
    codeTitle: '429 Example',
    code: `Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0`,
    responseTitle: 'Example JSON',
    response: `{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "retry_after_seconds": 60
}`,
    statusCodes: [
      { code: 429, title: 'Too Many Requests', description: 'Retry after the advertised cooldown window.' },
    ],
  },
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getApiSectionSlug(title) {
  return slugify(title);
}

function getApiEndpointSlug(endpoint) {
  return slugify(`${endpoint.method.toLowerCase()}-${endpoint.path.replace(/:/g, '').replace(/\//g, '-')}`);
}

function getApiEndpointHref(section, endpoint) {
  return `/docs/api-reference/${getApiSectionSlug(section.title)}/${getApiEndpointSlug(endpoint)}`;
}

function escapeYaml(value) {
  return String(value).replace(/"/g, '\\"');
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function codeFence(language, content) {
  return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/{/g, '&#123;')
    .replace(/}/g, '&#125;');
}

function escapeMdxText(value) {
  return String(value).replace(/{/g, '&#123;').replace(/}/g, '&#125;');
}

function classSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderBadge(label, value, className) {
  return `<div className="api-meta-group"><span className="api-meta-label">${escapeHtml(label)}</span><span className="api-badge ${className}">${escapeHtml(value)}</span></div>`;
}

function renderTextMeta(label, value) {
  return `<div className="api-meta-group"><span className="api-meta-label">${escapeHtml(label)}</span><span className="api-meta-value">${escapeHtml(value)}</span></div>`;
}

function renderEndpointMeta(data, endpoint) {
  const items = [
    renderBadge('Method', endpoint.method, `api-method-${classSlug(endpoint.method)}`),
    renderTextMeta('Path', endpoint.path),
    renderTextMeta('Base URL', data.baseUrl),
    renderTextMeta('Auth', endpoint.auth),
    renderBadge('Surface', endpoint.surface, `api-surface-${classSlug(endpoint.surface)}`),
    renderBadge('Stability', endpoint.stability, `api-stability-${classSlug(endpoint.stability)}`),
    renderBadge('Support', endpoint.support, `api-support-${classSlug(endpoint.support)}`),
    renderBadge('Deployment', endpoint.deployment, `api-deployment-${classSlug(endpoint.deployment)}`),
  ];

  return `<div className="api-meta not-prose">${items.join('')}</div>`;
}

function buildFieldTable(fields) {
  if (!fields || fields.length === 0) {
    return 'No fields are currently documented for this section.\n';
  }

  const lines = [
    '| Field | Type | Required | Description |',
    '|---|---|---|---|',
    ...fields.map((field) => `| \`${escapeTableCell(field.name)}\` | \`${escapeTableCell(field.type)}\` | ${field.required ? 'Yes' : 'No'} | ${escapeTableCell(field.description)} |`),
  ];

  return `${lines.join('\n')}\n`;
}

function buildStatusTable(statusCodes) {
  if (!statusCodes || statusCodes.length === 0) {
    return [
      '| Code | Title | Description |',
      '|---|---|---|',
      '| 200 | Success | The request completed successfully. For streaming or download endpoints, the success response may be a stream or attachment rather than a JSON object. |',
      '| 400 | Bad Request | The route was reached, but the request body, query string, or path parameter did not match the endpoint contract. |',
      '| 401 | Unauthorized | Credentials were missing, expired, malformed, or not accepted by this route. |',
      '| 429 | Too Many Requests | The caller exceeded the current throttle window and should wait before retrying. |',
      '| 500 | Server Error | The server accepted the request contract but failed while processing it. |',
    ].join('\n') + '\n';
  }

  const lines = [
    '| Code | Title | Description |',
    '|---|---|---|',
    ...statusCodes.map((status) => `| ${status.code} | ${escapeTableCell(status.title)} | ${escapeTableCell(status.description)} |`),
  ];

  return `${lines.join('\n')}\n`;
}

function loadBuildApiEndpointPageData() {
  const file = path.join(docsAppRoot, 'lib', 'api-reference-page-data.ts');
  let source = fs.readFileSync(file, 'utf8');

  source = source.replace(/import 'server-only';\n\n/, '');
  source = source.replace(/import type\s*{[\s\S]*?}\s*from '\@\/lib\/api-reference-shared';\n/, '');
  source = source.replace(
    /import\s*{[\s\S]*?}\s*from '\@\/lib\/api-reference-shared';\n/,
    "const { getApiEndpointHref, getApiEndpointSlug, getApiSectionSlug } = require('./api-reference-shared-runtime');\n"
  );

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: file,
  }).outputText;

  const runtimeModule = new Module(file, module);
  runtimeModule.filename = file;
  runtimeModule.paths = Module._nodeModulePaths(path.dirname(file));
  runtimeModule.require = (id) => {
    if (id === './api-reference-shared-runtime') {
      return {
        getApiEndpointHref,
        getApiEndpointSlug,
        getApiSectionSlug,
      };
    }
    return require(id);
  };
  runtimeModule._compile(transpiled, file);
  return runtimeModule.exports.buildApiEndpointPageData;
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function renderGuideMdx(guide) {
  const sections = guide.sections
    .map((section) => {
      const paragraphs = section.paragraphs.map((paragraph) => `${paragraph}\n`).join('\n');
      return `## ${section.title}\n\n${paragraphs}`;
    })
    .join('\n');

  let content = `---\ntitle: "${escapeYaml(guide.title)}"\ndescription: "${escapeYaml(guide.summary)}"\n---\n\n# ${guide.title}\n\n${guide.summary}\n\n${sections}`;

  if (guide.code) {
    content += `\n## ${guide.codeTitle}\n${codeFence('text', guide.code)}`;
  }

  if (guide.response) {
    content += `\n## ${guide.responseTitle}\n${codeFence('json', guide.response)}`;
  }

  if (guide.statusCodes) {
    content += `\n## Common Status Codes\n\n${buildStatusTable(guide.statusCodes)}`;
  }

  return `${content}\n`;
}

function renderIndexMdx() {
  const sections = apiSections
    .map((section) => {
      const links = section.endpoints
        .map((endpoint) => `- [\`${escapeMdxText(`${endpoint.method} ${endpoint.path}`)}\`](${getApiEndpointHref(section, endpoint)}) — ${endpoint.description}`)
        .join('\n');
      return `## ${section.title}\n\n${section.summary}\n\n${links}\n`;
    })
    .join('\n');

  const guideLinks = apiGuides
    .map((guide) => `- [${guide.title}](/docs/api-reference/${guide.slug}) — ${guide.summary}`)
    .join('\n');

  return `---
title: "API Reference"
description: "Customer-facing API guides and endpoint reference for Igris."
---

# API Reference

This is the customer-facing API contract for Igris. Use the guide pages first, then move into the grouped endpoint reference when you are implementing or debugging a specific route.

## Start Here

${guideLinks}

${sections}
`;
}

function renderEndpointMdx(section, endpoint, data) {
  const metadataBlock = renderEndpointMeta(data, endpoint);

  let content = `---
title: "${escapeYaml(data.title)}"
description: "${escapeYaml(data.functionality)}"
---

# ${escapeMdxText(data.title)}

${data.functionality}

${metadataBlock}

## When To Use

${data.whenToUse}

## Integration Guidance

${data.retryGuidance}
`;

  if (data.commonMistakes.length > 0) {
    content += `\n### Common Mistakes\n\n${data.commonMistakes.map((item) => `- ${item}`).join('\n')}\n`;
  }

  if (data.relatedEndpoints.length > 0) {
    content += `\n### Related Endpoints\n\n${data.relatedEndpoints.map((item) => `- [${escapeMdxText(item.label)}](${item.href})`).join('\n')}\n`;
  }

  if (data.relatedGuides.length > 0) {
    content += `\n### Related Guides\n\n${data.relatedGuides.map((item) => `- [${item.label}](${item.href})`).join('\n')}\n`;
  }

  if (data.pathParams.length > 0) {
    content += `\n## Path Parameters\n\n${buildFieldTable(data.pathParams)}`;
  }
  if (data.queryParams.length > 0) {
    content += `\n## Query Parameters\n\n${buildFieldTable(data.queryParams)}`;
  }
  if (data.requestBodyFields.length > 0) {
    content += `\n## Request Body\n\n${buildFieldTable(data.requestBodyFields)}`;
  }

  if (data.requestExample) {
    content += `\n## Request Example\n${codeFence('json', data.requestExample)}`;
  } else if (data.requestBodyFields.length > 0) {
    content += `\n## Request Example\n\nA runnable request body example is not available on this page yet.\n`;
  }

  if (data.notes.length > 0) {
    content += `\n## Notes\n\n${data.notes.map((note) => `- ${note}`).join('\n')}\n`;
  }

  content += '\n## Code Examples\n';
  for (const sample of data.codeSamples) {
    content += `\n### ${sample.label}\n${codeFence(sample.language, sample.code)}`;
  }

  if (data.responseExample) {
    content += `\n## Sample Response\n${codeFence(data.responseExampleLanguage || 'json', data.responseExample)}`;
  } else {
    content += '\n## Sample Response\n\nA response example is not available on this page yet.\n';
  }

  content += `\n## Status Codes\n\n${buildStatusTable(data.statusCodes)}`;

  const statusExamples = data.statusCodes.filter((status) => status.example);
  if (statusExamples.length > 0) {
    for (const status of statusExamples) {
      content += `\n### ${status.code} Example\n${codeFence('json', status.example)}`;
    }
  }

  return `${content}\n`;
}

function generateApiReferenceContent() {
  const buildApiEndpointPageData = loadBuildApiEndpointPageData();

  if (fs.existsSync(path.join(docsAppRoot, 'content', 'docs', 'api-reference.mdx'))) {
    fs.rmSync(path.join(docsAppRoot, 'content', 'docs', 'api-reference.mdx'));
  }

  fs.rmSync(apiReferenceDir, { recursive: true, force: true });
  fs.mkdirSync(apiReferenceDir, { recursive: true });

  const rootMeta = {
    title: 'API Reference',
    pages: ['index', ...apiGuides.map((guide) => guide.slug), ...apiSections.map((section) => getApiSectionSlug(section.title))],
  };
  writeFile(path.join(apiReferenceDir, 'meta.json'), `${JSON.stringify(rootMeta, null, 2)}\n`);
  writeFile(path.join(apiReferenceDir, 'index.mdx'), renderIndexMdx());

  for (const guide of apiGuides) {
    writeFile(path.join(apiReferenceDir, `${guide.slug}.mdx`), renderGuideMdx(guide));
  }

  for (const section of apiSections) {
    const sectionSlug = getApiSectionSlug(section.title);
    const sectionDir = path.join(apiReferenceDir, sectionSlug);
    const sectionMeta = {
      title: section.title,
      pages: section.endpoints.map((endpoint) => getApiEndpointSlug(endpoint)),
    };

    writeFile(path.join(sectionDir, 'meta.json'), `${JSON.stringify(sectionMeta, null, 2)}\n`);

    for (const endpoint of section.endpoints) {
      const data = buildApiEndpointPageData(section, endpoint);
      writeFile(
        path.join(sectionDir, `${getApiEndpointSlug(endpoint)}.mdx`),
        renderEndpointMdx(section, endpoint, data)
      );
    }
  }
}

module.exports = {
  generateApiReferenceContent,
};
