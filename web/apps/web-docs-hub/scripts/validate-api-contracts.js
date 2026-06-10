const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('../node_modules/typescript');

const { apiSections, docsAppRoot, generatedDir, repoRoot } = require('./docs-data');

const SOURCE_SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'target', 'dist', 'out']);

const SOURCE_ROUTE_SCHEMA_OVERRIDES = {
  'POST /v1/actions': {
    language: 'go',
    schema: 'actionDefinitionRequest',
    reason: 'routes_actions.go handleActionCreate parses the body as actionDefinitionRequest before normalizeActionDefinitionRequest validation.',
  },
  'PATCH /v1/actions/:id': {
    language: 'go',
    schema: 'actionDefinitionRequest',
    reason: 'routes_actions.go handleActionPatch parses the body as actionDefinitionRequest; omitted fields keep their current values.',
  },
  'POST /v1/actions/run': {
    language: 'go',
    schema: 'actionRunRequest',
    reason: 'routes_actions.go handleActionRun parses the body as actionRunRequest and resolves the registered action by id or name.',
  },
  'POST /v1/actions/:name/run': {
    language: 'go',
    schema: 'actionRunByNameRequest',
    reason: 'routes_actions.go handleActionRunByName parses the body as actionRunByNameRequest for the registered action named in the path.',
  },
  'POST /v1/infer': {
    language: 'go',
    schema: 'InferRequest',
    reason: 'routes_infer.go delegates to the shared Overture inference handler, whose request contract is models.InferRequest.',
  },
  'POST /v1/chat/completions': {
    language: 'go',
    schema: 'InferRequest',
    reason: 'routes_infer.go registers the OpenAI-compatible path on the same Overture inference handler as /v1/infer.',
  },
  'POST /v1/tasks/submit': {
    language: 'go',
    schema: 'publicTaskSubmitRequest',
    reason: 'routes_tasks.go parses this public request through buildTaskSubmitRequest before normalizing to coordinator.TaskSubmitRequest.',
  },
  'POST /proof/receipts/verify': {
    language: 'go',
    schema: 'VerifyReceiptRequest',
    reason: 'routes_proof.go parses this body through ProofHandler.VerifyReceipt after auth middleware.',
  },
};

const EXAMPLE_ONLY_SCHEMA_REASONS = {
  'POST /v1/infer/multimodal': 'The route accepts a multipart/media-flavored inference envelope; docs keep the customer example while source schema extraction is JSON-struct only.',
  'POST /api/v1/runtime/register': 'Runtime fleet registration is validated inside the route handler and documented from the registration example used by the runtime client.',
  'POST /api/v1/runtime/heartbeat': 'Runtime heartbeat is a fleet liveness payload; route-level validation is implemented procedurally instead of through a reusable request struct.',
  'POST /api/v1/runtime/config/push': 'Configuration push is an operational control-plane route whose request body is example-backed until a public source schema is promoted.',
  'POST /api/v1/runtime/update': 'Runtime update orchestration is validated procedurally and remains example-backed in the public docs.',
  'POST /v1/account/api-key': 'API key creation does not require a JSON body; the endpoint is bodyless and response-focused.',
  'POST /v1/vault/keys': 'Vault key storage uses handler validation for provider/key payloads; docs carry the current public example until a reusable schema is exported.',
  'POST /v1/vault/keys/:provider/rotate': 'Provider rotation is path-param driven and bodyless in the public contract.',
  'POST /v1/vault/keys/:provider/validate': 'Provider validation is path-param driven and bodyless in the public contract.',
  'PUT /v1/policy': 'Policy update accepts a policy document whose structure is governed by the policy engine, not by a small route request struct.',
  'POST /v1/routing/strategy': 'Routing strategy uses a compact handler-validated payload; docs keep an example-backed contract until the route exports a reusable schema.',
  'POST /v1/routing/provider_weights': 'Provider weights are a map-like tuning payload and are validated procedurally by the routing handler.',
  'POST /v1/routing/speculative': 'Speculative routing accepts an experiment request shape that is still preview and handler-validated.',
  'POST /v1/routing/speculative/simulate': 'Speculative simulation is preview and example-backed because the handler accepts simulation parameters rather than a stable exported schema.',
  'POST /v1/routing/council': 'Council mode routing is preview and validated in handler code rather than through a stable public request struct.',
  'POST /v1/routing/shadow': 'Shadow routing is preview and handler-validated, so docs keep the current example-only shape.',
  'POST /v1/bt/definitions': 'Behavior tree definitions are validated by the behavior-tree schema engine rather than a route request struct.',
  'POST /v1/tasks/:id/cancel': 'Task cancellation is path-param driven and bodyless in the public contract.',
  'POST /v1/tasks/:id/proof/verify': 'Task proof verification is path-param driven and reconciles persisted proof state; no JSON body is required.',
  'POST /v1/mcp': 'MCP transport carries JSON-RPC envelopes whose schema lives in the MCP method contract rather than a route-specific request struct.',
  'POST /v1/plan': 'Local planning is a runtime-local convenience route with handler validation and an example-backed JSON shape.',
  'POST /v1/reflect': 'Local reflection is a runtime-local convenience route with handler validation and an example-backed JSON shape.',
  'POST /v1/admin/models/load': 'Model loading is an admin operation validated against runtime model-manager state rather than a public route struct.',
  'POST /v1/admin/models/swap': 'Model swapping is an admin operation validated against runtime model-manager state rather than a public route struct.',
  'POST /v1/btree/validate': 'Runtime behavior-tree validation delegates to the behavior-tree schema engine.',
  'POST /v1/btree/run': 'Runtime behavior-tree execution delegates to the behavior-tree engine and accepts tree documents rather than a small route struct.',
  'POST /v1/btree/deploy': 'Runtime behavior-tree deployment delegates to the behavior-tree engine and validates tree documents internally.',
  'POST /v1/hitl/request': 'Human-review request payloads are runtime-local and currently validated procedurally by the handler.',
  'POST /v1/hitl/approve': 'Human-review approval payloads are runtime-local and currently validated procedurally by the handler.',
  'POST /v1/hitl/reject': 'Human-review rejection payloads are runtime-local and currently validated procedurally by the handler.',
  'POST /v1/swarm/join': 'Swarm membership is runtime-local and handler-validated against peer state.',
  'POST /v1/swarm/propose': 'Swarm proposal payloads are runtime-local and handler-validated against peer state.',
  'POST /v1/swarm/vote': 'Swarm vote payloads are runtime-local and handler-validated against peer state.',
  'POST /v1/federated/update': 'Federated update payloads are runtime-local and handler-validated by the federated coordinator.',
  'POST /v1/runtime/execute': 'Runtime execute accepts an execution envelope whose validation is performed by the runtime execution engine.',
  'POST /v1/runtime/task/:task_id/cancel': 'Runtime task cancellation is path-param driven and bodyless in the public contract.',
};

const CORE_RESPONSE_CONTRACTS = {
  'POST /v1/chat/completions': {
    schema: { language: 'go', name: 'InferResponse' },
    requiredFields: ['id', 'object', 'created', 'model', 'choices'],
    evidence: 'igris-overture/models/infer_response.go',
  },
  'POST /v1/infer': {
    schema: { language: 'go', name: 'InferResponse' },
    requiredFields: ['id', 'object', 'created', 'model', 'choices'],
    evidence: 'igris-overture/models/infer_response.go',
  },
  'POST /v1/tasks/submit': {
    requiredFields: ['task_id', 'status', 'created_at', 'lifecycle', 'durability', 'recovery'],
    evidence: 'igris-overture/api/routes_tasks.go buildTaskAcceptedResponse',
  },
  'GET /v1/receipts': {
    schema: { language: 'go', name: 'Receipt' },
    requiredFields: ['execution_id', 'agent_id', 'runtime_id', 'tenant_id', 'timestamp_utc', 'wall_time_ms', 'cpu_time_ms', 'memory_peak_mb', 'tool_calls', 'violation_occurred', 'status', 'receipt_hash', 'previous_hash', 'signature'],
    array: true,
    evidence: 'igris-overture/api/routes_receipts.go',
  },
  'POST /proof/receipts/verify': {
    schema: { language: 'go', name: 'VerifyReceiptResponse' },
    requiredFields: ['valid', 'execution_id', 'hash', 'signature'],
    evidence: 'igris-overture/api/routes_proof.go',
  },
  'POST /v1/runtime/task/submit': {
    schema: { language: 'rust', name: 'TaskSubmitResponse' },
    requiredFields: ['task_id', 'steps_completed', 'steps_total', 'status'],
    evidence: 'igris-runtime/crates/igris-server/src/task_executor.rs TaskSubmitResponse',
  },
  'POST /v1/runtime/task/stream': {
    requiredFields: ['task_id', 'status', 'durability'],
    evidence: 'igris-runtime/crates/igris-server/src/task_executor.rs build_task_result_payload',
    source: 'sse-task-result',
  },
  'POST /v1/runtime/task/:task_id/cancel': {
    requiredFields: ['task_id', 'canceled', 'known', 'active_execution', 'cancellation_allowed', 'reason'],
    evidence: 'igris-runtime/crates/igris-server/src/task_executor.rs build_task_cancel_response',
  },
  'GET /v1/runtime/task/:task_id/wal': {
    requiredFields: ['task_id', 'entries', 'count'],
    evidence: 'igris-runtime/crates/igris-server/src/task_executor.rs handle_task_wal',
  },
};

function walk(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SOURCE_SKIP_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), predicate, files);
      }
    } else if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      if (predicate(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function canonicalRoutePath(routePath) {
  return routePath.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
}

function endpointKey(endpoint) {
  return `${endpoint.method} ${canonicalRoutePath(endpoint.path)}`;
}

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

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function parseGoStructs(files) {
  const schemas = new Map();

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const structRegex = /^type\s+(\w+)\s+struct\s*{/gm;
    let match;
    while ((match = structRegex.exec(source)) !== null) {
      const name = match[1];
      const openIndex = source.indexOf('{', match.index);
      const closeIndex = findMatchingBrace(source, openIndex);
      if (closeIndex < 0) {
        continue;
      }
      const body = source.slice(openIndex + 1, closeIndex);
      const fields = [];
      for (const line of body.split(/\r?\n/)) {
        const fieldMatch = line.trim().match(/^(\w+)\s+(.+?)\s+`[^`]*json:"([^"]+)"/);
        if (!fieldMatch) {
          continue;
        }
        const [, , typeName, jsonTag] = fieldMatch;
        const [jsonName, ...options] = jsonTag.split(',');
        if (!jsonName || jsonName === '-') {
          continue;
        }
        fields.push({
          name: jsonName,
          required: !options.includes('omitempty') && !typeName.trim().startsWith('*'),
          type: typeName.trim(),
        });
      }
      if (fields.length > 0) {
        schemas.set(name, { language: 'go', name, file: relative(filePath), fields });
      }
    }
  }

  return schemas;
}

function parseRustStructs(files) {
  const schemas = new Map();

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const structRegex = /(?:pub\s+)?struct\s+(\w+)\s*{/g;
    let match;
    while ((match = structRegex.exec(source)) !== null) {
      const name = match[1];
      const openIndex = source.indexOf('{', match.index);
      const closeIndex = findMatchingBrace(source, openIndex);
      if (closeIndex < 0) {
        continue;
      }
      const body = source.slice(openIndex + 1, closeIndex);
      const fields = [];
      let attrs = [];
      for (const rawLine of body.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.startsWith('#[')) {
          attrs.push(line);
          continue;
        }
        const fieldMatch = line.match(/^(?:pub(?:\(crate\))?\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^,]+),?/);
        if (!fieldMatch) {
          attrs = [];
          continue;
        }
        const [, fieldName, typeName] = fieldMatch;
        const rename = attrs.join(' ').match(/rename\s*=\s*"([^"]+)"/)?.[1];
        const hasDefault = attrs.some((attr) => attr.includes('serde(default)') || attr.includes('default'));
        fields.push({
          name: rename ?? fieldName,
          required: !hasDefault && !typeName.includes('Option<'),
          type: typeName.trim(),
        });
        attrs = [];
      }
      if (fields.length > 0) {
        schemas.set(name, { language: 'rust', name, file: relative(filePath), fields });
      }
    }
  }

  return schemas;
}

function extractGoRoutesAndSchemas(files, goSchemas) {
  const contracts = new Map();

  for (const filePath of files) {
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
        const value = `${prefixes.get(baseName)}${suffix}`.replace(/\/+/g, '/');
        if (prefixes.get(name) !== value) {
          prefixes.set(name, value);
          changed = true;
        }
      }
    }

    const routeRegex = /(\w+)\.(Get|Post|Put|Patch|Delete)\("([^"]*)",\s*([^)]+)\)/g;
    let match;
    while ((match = routeRegex.exec(source)) !== null) {
      const [, baseName, method, suffix, handlerExpr] = match;
      if (!prefixes.has(baseName)) {
        continue;
      }
      const handlerName = handlerExpr.trim().split('.').pop().replace(/[^\w].*$/, '');
      const requestType = findGoHandlerRequestType(source, handlerName);
      if (!requestType || !goSchemas.has(requestType)) {
        continue;
      }
      const routePath = `${prefixes.get(baseName)}${suffix}`.replace(/\/+/g, '/');
      const key = `${method.toUpperCase()} ${canonicalRoutePath(routePath)}`;
      const contract = {
        ...goSchemas.get(requestType),
        handler: handlerExpr.trim(),
      };
      const existing = contracts.get(key);
      if (!existing || sourceContractPriority(contract) >= sourceContractPriority(existing)) {
        contracts.set(key, contract);
      }
    }
  }

  return contracts;
}

function sourceContractPriority(contract) {
  if (contract.file.endsWith('routes_runtime.go')) {
    return 30;
  }
  if (contract.file.includes('/api/routes_')) {
    return 20;
  }
  return 10;
}

function findGoHandlerRequestType(source, handlerName) {
  const functionRegex = new RegExp(`func\\s*(?:\\([^)]*\\)\\s*)?${handlerName}\\s*\\([^)]*\\)\\s*error\\s*{`, 'g');
  const match = functionRegex.exec(source);
  if (!match) {
    return null;
  }
  const openIndex = source.indexOf('{', match.index);
  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex < 0) {
    return null;
  }
  const body = source.slice(openIndex + 1, closeIndex);
  const parserMatch = body.match(/BodyParser\(&(\w+)\)/);
  if (!parserMatch) {
    return null;
  }
  const varName = parserMatch[1];
  return body.match(new RegExp(`var\\s+${varName}\\s+(\\w+)`))?.[1] ?? null;
}

function extractRustRoutesAndSchemas(files, rustSchemas) {
  const contracts = new Map();
  const handlerTypes = new Map();

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const functionRegex = /(?:pub\s+)?async\s+fn\s+(\w+)\s*\(/g;
    let match;
    while ((match = functionRegex.exec(source)) !== null) {
      const [, handlerName] = match;
      const openBrace = source.indexOf('{', match.index);
      if (openBrace < 0) {
        continue;
      }
      const signature = source.slice(match.index, openBrace);
      const typeName = signature.match(/Json(?:\([^)]*\))?\s*:\s*Json<([a-zA-Z0-9_:]+)>/)?.[1]?.split('::').pop();
      if (typeName && rustSchemas.has(typeName)) {
        handlerTypes.set(handlerName, rustSchemas.get(typeName));
      }
    }
  }

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const routeRegex = /\.route\(\s*"([^"]+)",\s*(get|post|put|patch|delete)\(([^)]+)\)\s*,?\s*\)/g;
    let match;
    while ((match = routeRegex.exec(source)) !== null) {
      const [, routePath, method, handlerExpr] = match;
      const handlerName = handlerExpr.trim().split('::').pop();
      if (!handlerTypes.has(handlerName)) {
        continue;
      }
      contracts.set(`${method.toUpperCase()} ${canonicalRoutePath(routePath)}`, {
        ...handlerTypes.get(handlerName),
        handler: handlerExpr.trim(),
      });
    }
  }

  return contracts;
}

function buildSourceIndex() {
  const goFiles = [
    ...walk(path.join(repoRoot, 'igris-overture', 'api'), (filePath) => filePath.endsWith('.go') && !filePath.endsWith('_test.go')),
    ...walk(path.join(repoRoot, 'igris-overture', 'models'), (filePath) => filePath.endsWith('.go') && !filePath.endsWith('_test.go')),
  ];
  const rustFiles = walk(path.join(repoRoot, 'igris-runtime', 'crates', 'igris-server', 'src'), (filePath) => filePath.endsWith('.rs') && !filePath.endsWith('_test.rs'));
  const goSchemas = parseGoStructs(goFiles);
  const rustSchemas = parseRustStructs(rustFiles);
  const requestContracts = new Map([
    ...extractGoRoutesAndSchemas(goFiles, goSchemas),
    ...extractRustRoutesAndSchemas(rustFiles, rustSchemas),
  ]);

  for (const [key, override] of Object.entries(SOURCE_ROUTE_SCHEMA_OVERRIDES)) {
    const schemas = override.language === 'rust' ? rustSchemas : goSchemas;
    const schema = schemas.get(override.schema);
    if (schema) {
      requestContracts.set(key, {
        ...schema,
        handler: override.reason,
      });
    }
  }

  return { requestContracts, goSchemas, rustSchemas };
}

function parseJsonExample(label, value, failures) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    failures.push(`${label}: invalid JSON example (${error.message})`);
    return null;
  }
}

function getSchema(sourceIndex, schemaRef) {
  if (!schemaRef) {
    return null;
  }
  const schemas = schemaRef.language === 'rust' ? sourceIndex.rustSchemas : sourceIndex.goSchemas;
  return schemas.get(schemaRef.name) ?? null;
}

function documentedResponseObjects(data, key, failures) {
  if (!data.responseExample) {
    return [];
  }
  if (data.responseExampleLanguage === 'jsonl') {
    return data.responseExample
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => parseJsonExample(`${key} responseExample line ${index + 1}`, line, failures))
      .filter((value) => value && typeof value === 'object');
  }
  if (data.responseExampleLanguage === 'text') {
    return data.responseExample
      .split(/\r?\n/)
      .map((line) => line.match(/^data:\s*(\{.*\})\s*$/)?.[1])
      .filter(Boolean)
      .map((line, index) => parseJsonExample(`${key} responseExample SSE data ${index + 1}`, line, failures))
      .filter((value) => value && typeof value === 'object');
  }
  if (!data.responseExampleLanguage || data.responseExampleLanguage === 'json') {
    const parsed = parseJsonExample(`${key} responseExample`, data.responseExample, failures);
    return parsed && typeof parsed === 'object' ? [parsed] : [];
  }
  return [];
}

function responseObjectForContract(objects, contract) {
  if (contract.source === 'sse-task-result') {
    return objects.find((item) => !Array.isArray(item) && 'durability' in item) ?? objects[0];
  }
  return objects[0];
}

function objectHasField(value, fieldName) {
  if (Array.isArray(value)) {
    return value.length > 0 && objectHasField(value[0], fieldName);
  }
  return value && typeof value === 'object' && fieldName in value;
}

function requiredResponseFields(sourceIndex, contract) {
  const schema = getSchema(sourceIndex, contract.schema);
  const schemaFields = schema ? schema.fields.filter((field) => field.required).map((field) => field.name) : [];
  return [...new Set([...(contract.requiredFields ?? []), ...schemaFields])];
}

function validateResponseContract(key, data, sourceIndex, failures) {
  const contract = CORE_RESPONSE_CONTRACTS[key];
  if (!contract) {
    return null;
  }

  if (!data.responseExample) {
    failures.push(`${key}: core response contract is enabled but responseExample is missing (${contract.evidence})`);
    return {
      fields: contract.requiredFields?.length ?? 0,
      evidence: contract.evidence,
      status: 'missing-example',
    };
  }

  const responseObjects = documentedResponseObjects(data, key, failures);
  const object = responseObjectForContract(responseObjects, contract);
  if (!object) {
    failures.push(`${key}: responseExample does not contain a JSON object that can be checked against ${contract.evidence}`);
    return {
      fields: contract.requiredFields?.length ?? 0,
      evidence: contract.evidence,
      status: 'missing-json-object',
    };
  }

  const requiredFields = requiredResponseFields(sourceIndex, contract);
  for (const fieldName of requiredFields) {
    if (!objectHasField(object, fieldName)) {
      failures.push(`${key}: responseExample is missing required response field "${fieldName}" from ${contract.evidence}`);
    }
  }

  return {
    fields: requiredFields.length,
    evidence: contract.evidence,
    status: 'verified',
  };
}

function validateMutationSchemaPolicy(key, endpoint, sourceContract, row, failures) {
  if (!['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    return;
  }
  if (sourceContract) {
    row.schema_policy = 'source-backed';
    return;
  }
  const reason = EXAMPLE_ONLY_SCHEMA_REASONS[key];
  if (!reason) {
    failures.push(`${key}: mutating route is not source-schema backed and has no example-only reason in EXAMPLE_ONLY_SCHEMA_REASONS`);
    row.schema_policy = 'missing-policy';
    return;
  }
  row.schema_policy = `example-only: ${reason}`;
}

function validateEndpoint(section, endpoint, data, sourceIndex, failures, rows) {
  const key = endpointKey(endpoint);
  const documentedBodyFields = data.requestBodyFields ?? [];
  const sourceContract = sourceIndex.requestContracts.get(key);
  const row = {
    endpoint: key,
    source_schema: sourceContract ? `${sourceContract.name} (${sourceContract.language}, ${sourceContract.file})` : null,
    request_fields: documentedBodyFields.length,
    response_contract: null,
    response_fields: 0,
    schema_policy: endpoint.method === 'GET' || endpoint.method === 'DELETE' ? 'not-required' : null,
    status: 'verified',
  };

  if (documentedBodyFields.length > 0) {
    if (!data.requestExample) {
      failures.push(`${key}: request body fields are documented but requestExample is missing`);
    }
    const requestExample = parseJsonExample(`${key} requestExample`, data.requestExample, failures);
    if (requestExample && typeof requestExample === 'object' && !Array.isArray(requestExample)) {
      for (const field of documentedBodyFields.filter((item) => item.required)) {
        if (!(field.name in requestExample)) {
          failures.push(`${key}: requestExample is missing required documented field "${field.name}"`);
        }
      }
    }
  }

  if (data.responseExample && (!data.responseExampleLanguage || data.responseExampleLanguage === 'json')) {
    parseJsonExample(`${key} responseExample`, data.responseExample, failures);
  }
  if (data.responseExample && data.responseExampleLanguage === 'jsonl') {
    for (const [index, line] of data.responseExample.split(/\r?\n/).filter(Boolean).entries()) {
      parseJsonExample(`${key} responseExample line ${index + 1}`, line, failures);
    }
  }
  for (const status of data.statusCodes ?? []) {
    if (status.example) {
      parseJsonExample(`${key} ${status.code} status example`, status.example, failures);
    }
  }

  if (sourceContract && documentedBodyFields.length > 0) {
    const sourceFields = new Map(sourceContract.fields.map((field) => [field.name, field]));
    const documentedNames = new Set(documentedBodyFields.map((field) => field.name));
    for (const field of documentedBodyFields) {
      if (!sourceFields.has(field.name)) {
        failures.push(`${key}: documented request field "${field.name}" is not present in source schema ${sourceContract.name} (${sourceContract.file})`);
      }
    }
    for (const field of sourceContract.fields.filter((item) => item.required)) {
      if (!documentedNames.has(field.name)) {
        failures.push(`${key}: source schema ${sourceContract.name} requires "${field.name}" but the API reference does not document it`);
      }
    }
  } else if (documentedBodyFields.length > 0) {
    row.status = 'example-validated';
  }

  validateMutationSchemaPolicy(key, endpoint, sourceContract, row, failures);
  const responseContract = validateResponseContract(key, data, sourceIndex, failures);
  if (responseContract) {
    row.response_contract = responseContract.evidence;
    row.response_fields = responseContract.fields;
  }

  rows.push(row);
}

function renderMarkdown(rows) {
  const lines = [
    '# API Contract Validation',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report validates API reference request/response examples and compares documented request body fields against source request schemas when handlers expose a Go request struct or Rust JSON/OpenAPI schema.',
    '',
    '| Endpoint | Request fields | Source schema | Schema policy | Response contract | Response fields | Status |',
    '| --- | ---: | --- | --- | --- | ---: | --- |',
  ];

  for (const row of rows) {
    lines.push(`| \`${row.endpoint}\` | ${row.request_fields} | ${row.source_schema ? `\`${row.source_schema}\`` : 'not discovered'} | ${row.schema_policy ?? 'n/a'} | ${row.response_contract ? `\`${row.response_contract}\`` : 'not required'} | ${row.response_fields} | ${row.status} |`);
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const failures = [];
  const rows = [];
  const buildApiEndpointPageData = loadBuildApiEndpointPageData();
  const sourceIndex = buildSourceIndex();

  for (const section of apiSections) {
    for (const endpoint of section.endpoints) {
      const data = buildApiEndpointPageData(section, endpoint);
      validateEndpoint(section, endpoint, data, sourceIndex, failures, rows);
    }
  }

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, 'api-contract-validation.json'),
    `${JSON.stringify({ generated_at: new Date().toISOString(), endpoints: rows }, null, 2)}\n`
  );
  fs.writeFileSync(path.join(generatedDir, 'api-contract-validation.md'), renderMarkdown(rows));

  if (failures.length > 0) {
    console.error('API contract validation failed:\n');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  const schemaBacked = rows.filter((row) => row.source_schema).length;
  const responseBacked = rows.filter((row) => row.response_contract).length;
  console.log(`API contract validation passed: ${rows.length} endpoints, ${schemaBacked} source-backed request schemas, ${responseBacked} response contracts`);
}

main();
