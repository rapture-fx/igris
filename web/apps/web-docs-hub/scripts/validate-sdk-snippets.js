const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { docsAppRoot, docsDir, generatedDir, repoRoot, sdkSupport } = require('./docs-data');

const SDK_DOCS = [
  path.join(docsDir, 'sdk.mdx'),
  path.join(docsDir, 'sdk-integration-patterns.mdx'),
];

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function resolveSdkRoots() {
  const jsRoot = firstExistingPath([
    path.join(repoRoot, 'igris-javascript-sdk'),
    path.join(repoRoot, 'labs', 'packages', 'javascript-sdk'),
  ]);
  const goRoot = firstExistingPath([
    path.join(repoRoot, 'igris-go-sdk'),
  ]);
  const rustRoot = firstExistingPath([
    path.join(repoRoot, 'igris-rust-sdk'),
  ]);

  return { jsRoot, goRoot, rustRoot };
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractCodeBlocks(filePath) {
  const content = read(filePath);
  const blocks = [];
  const regex = /```([a-zA-Z0-9_-]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      file: path.relative(repoRoot, filePath),
      language: match[1].toLowerCase(),
      code: match[2],
      line: content.slice(0, match.index).split(/\r?\n/).length,
    });
  }
  return blocks;
}

function extractNamedImports(code, moduleName) {
  const imports = [];
  const regex = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g');
  let match;
  while ((match = regex.exec(code)) !== null) {
    imports.push(...match[1].split(',').map((item) => item.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean));
  }
  return imports;
}

function extractGoModule(goRoot) {
  const goMod = read(path.join(goRoot, 'go.mod'));
  return goMod.match(/^module\s+(.+)$/m)?.[1]?.trim();
}

function extractJsExports(jsRoot) {
  const source = read(path.join(jsRoot, 'src', 'index.ts'));
  const exports = new Set();
  for (const match of source.matchAll(/export\s+\{([^}]+)\}/g)) {
    for (const name of match[1].split(',')) {
      const cleaned = name.trim().split(/\s+as\s+/)[0].trim();
      if (cleaned) exports.add(cleaned);
    }
  }
  for (const match of source.matchAll(/export\s+type\s+\{([^}]+)\}/g)) {
    for (const name of match[1].split(',')) {
      const cleaned = name.trim().split(/\s+as\s+/)[0].trim();
      if (cleaned) exports.add(cleaned);
    }
  }
  return exports;
}

function extractClassMethods(source, className) {
  const classIndex = source.indexOf(`class ${className}`);
  if (classIndex < 0) {
    return new Set();
  }
  const openIndex = source.indexOf('{', classIndex);
  const closeIndex = findMatchingBrace(source, openIndex);
  const body = source.slice(openIndex + 1, closeIndex);
  return new Set([...body.matchAll(/(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:<[^>]*>)?\s*\(/g)].map((match) => match[1]));
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return source.length - 1;
}

function extractGoSymbols(goRoot) {
  const files = fs.readdirSync(goRoot).filter((file) => file.endsWith('.go'));
  const functions = new Set();
  const methods = new Set();
  const types = new Set();

  for (const file of files) {
    const source = read(path.join(goRoot, file));
    for (const match of source.matchAll(/^func\s+(\w+)\s*\(/gm)) functions.add(match[1]);
    for (const match of source.matchAll(/^func\s+\([^)]*\)\s+(\w+)\s*\(/gm)) methods.add(match[1]);
    for (const match of source.matchAll(/^type\s+(\w+)\s+/gm)) types.add(match[1]);
  }

  return { functions, methods, types };
}

function extractRustExports(rustRoot) {
  const lib = read(path.join(rustRoot, 'src', 'lib.rs'));
  const exports = new Set();
  for (const match of lib.matchAll(/pub\s+use\s+[\w:]+::\{([^}]+)\}/g)) {
    for (const item of match[1].split(',')) {
      const cleaned = item.trim().split(/\s+as\s+/)[0].trim();
      if (cleaned) exports.add(cleaned);
    }
  }
  for (const match of lib.matchAll(/pub\s+use\s+[\w:]+::([A-Za-z0-9_]+)/g)) {
    exports.add(match[1]);
  }
  if (/pub\s+use\s+types::\*/.test(lib)) {
    const types = read(path.join(rustRoot, 'src', 'types.rs'));
    for (const match of types.matchAll(/^pub\s+struct\s+(\w+)/gm)) exports.add(match[1]);
    for (const match of types.matchAll(/^pub\s+enum\s+(\w+)/gm)) exports.add(match[1]);
  }
  return exports;
}

function extractRustImplMethods(source, typeName) {
  const methods = new Set();
  const implRegex = new RegExp(`impl\\s+${typeName}\\s*{`, 'g');
  let match;
  while ((match = implRegex.exec(source)) !== null) {
    const openIndex = source.indexOf('{', match.index);
    const closeIndex = findMatchingBrace(source, openIndex);
    const body = source.slice(openIndex + 1, closeIndex);
    for (const methodMatch of body.matchAll(/pub\s+(?:async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
      methods.add(methodMatch[1]);
    }
  }
  return methods;
}

function validateJavaScript(block, context, failures) {
  if (!['typescript', 'ts', 'javascript', 'js'].includes(block.language)) {
    return null;
  }

  const matched = block.code.includes(context.jsPackageName) || block.code.includes('new IgrisClient') || block.code.includes('client.');
  if (!context.jsAvailable) {
    return matched;
  }

  const namedImports = extractNamedImports(block.code, context.jsPackageName);
  for (const name of namedImports) {
    if (!context.jsExports.has(name)) {
      failures.push(`${block.file}:${block.line}: JavaScript snippet imports ${name}, but ${context.jsPackageName} does not export it.`);
    }
  }

  for (const match of block.code.matchAll(/\bclient\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
    const method = match[1];
    if (!context.jsClientMethods.has(method)) {
      failures.push(`${block.file}:${block.line}: JavaScript snippet calls client.${method}(), but IgrisClient does not implement it.`);
    }
  }
  return matched;
}

function validateGo(block, context, failures) {
  if (block.language !== 'go') {
    return null;
  }

  const matched = block.code.includes(context.goModule) || block.code.includes('igris.');
  if (!context.goAvailable) {
    return matched;
  }

  if (block.code.includes('github.com/') && !block.code.includes(context.goModule)) {
    failures.push(`${block.file}:${block.line}: Go snippet must import ${context.goModule}.`);
  }
  for (const match of block.code.matchAll(/\bigris\.([A-Z][A-Za-z0-9_]*)\b/g)) {
    const symbol = match[1];
    if (!context.goSymbols.functions.has(symbol) && !context.goSymbols.types.has(symbol)) {
      failures.push(`${block.file}:${block.line}: Go snippet references igris.${symbol}, but the Go SDK does not expose that symbol.`);
    }
  }
  for (const match of block.code.matchAll(/\bclient\.([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
    const method = match[1];
    if (!context.goSymbols.methods.has(method)) {
      failures.push(`${block.file}:${block.line}: Go snippet calls client.${method}(), but *igris.Client does not implement it.`);
    }
  }
  return matched;
}

function validateRust(block, context, failures) {
  if (block.language !== 'rust') {
    return null;
  }

  const crate = context.rustCrate.replace(/-/g, '_');
  const matched = block.code.includes(crate) || block.code.includes('IgrisClient');
  if (!context.rustAvailable) {
    return matched;
  }

  const importMatch = block.code.match(new RegExp(`use\\s+${crate}::\\{([^}]+)\\}`));
  if (importMatch) {
    for (const name of importMatch[1].split(',').map((item) => item.trim()).filter(Boolean)) {
      if (!context.rustExports.has(name)) {
        failures.push(`${block.file}:${block.line}: Rust snippet imports ${name}, but ${crate} does not export it.`);
      }
    }
  }
  if (block.code.includes(`${crate}::`) && !block.code.includes(`use ${crate}`)) {
    failures.push(`${block.file}:${block.line}: Rust snippet references ${crate} without an import checked by this validator.`);
  }
  if (block.code.includes('.infer(') && !context.rustClientMethods.has('infer')) {
    failures.push(`${block.file}:${block.line}: Rust snippet calls .infer(), but IgrisClient does not implement it.`);
  }
  if (block.code.includes('IgrisClient::builder') && !context.rustClientMethods.has('builder')) {
    failures.push(`${block.file}:${block.line}: Rust snippet calls IgrisClient::builder(), but the Rust SDK does not implement it.`);
  }
  return matched;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function posixRelative(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

function cleanGeneratedExamples() {
  const examplesDir = path.join(generatedDir, 'sdk-compile-examples');
  fs.rmSync(examplesDir, { recursive: true, force: true });
  ensureDir(examplesDir);
  return examplesDir;
}

function normalizeTypeScriptExample(block, index, context) {
  let code = block.code.trim();
  const usesNativeSdk = code.includes(context.jsPackageName) || code.includes('client.');
  if (!usesNativeSdk || code.includes("from 'openai'") || code.includes('from "openai"')) {
    return null;
  }
  if (!code.includes(context.jsPackageName)) {
    code = `import { IgrisClient } from '${context.jsPackageName}';\n\nconst client = new IgrisClient({\n  baseUrl: process.env.IGRIS_BASE_URL ?? 'https://overture.igrisinertial.com',\n  apiKey: process.env.IGRIS_API_KEY,\n});\n\n${code}`;
  }
  return {
    fileName: `snippet_${index}.ts`,
    code: `${code}\n`,
  };
}

function writeTypeScriptExamples(baseDir, blocks, context) {
  const tsDir = path.join(baseDir, 'typescript');
  ensureDir(tsDir);
  const examples = [];
  if (!context.jsAvailable || !context.jsRoot) {
    return { dir: tsDir, examples };
  }
  for (const [index, block] of blocks.entries()) {
    if (!['typescript', 'ts', 'javascript', 'js'].includes(block.language)) {
      continue;
    }
    const example = normalizeTypeScriptExample(block, index + 1, context);
    if (!example) {
      continue;
    }
    const fullPath = path.join(tsDir, example.fileName);
    fs.writeFileSync(fullPath, example.code);
    examples.push({
      source: `${block.file}:${block.line}`,
      generated: path.relative(repoRoot, fullPath),
    });
  }

  if (examples.length > 0) {
    fs.writeFileSync(
      path.join(tsDir, 'optional-deps.d.ts'),
      "declare module 'js-yaml';\n"
    );
    const sdkIndex = path.join(context.jsRoot, 'src', 'index.ts');
    fs.writeFileSync(
      path.join(tsDir, 'tsconfig.json'),
      `${JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          lib: ['ES2022', 'DOM'],
          types: ['node'],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          baseUrl: '.',
          paths: {
            [context.jsPackageName]: [posixRelative(tsDir, sdkIndex)],
          },
        },
        include: ['*.ts', '*.d.ts'],
      }, null, 2)}\n`
    );
  }

  return { dir: tsDir, examples };
}

function writeGoExamples(baseDir, blocks, context) {
  const goDir = path.join(baseDir, 'go');
  ensureDir(goDir);
  const examples = [];
  if (!context.goAvailable || !context.goRoot) {
    return { dir: goDir, examples };
  }
  for (const [index, block] of blocks.entries()) {
    if (block.language !== 'go') {
      continue;
    }
    const matched = block.code.includes(context.goModule) || block.code.includes('igris.');
    if (!matched) {
      continue;
    }
    const snippetDir = path.join(goDir, `snippet_${index + 1}`);
    ensureDir(snippetDir);
    const fullPath = path.join(snippetDir, 'example.go');
    fs.writeFileSync(fullPath, `${block.code.trim()}\n`);
    examples.push({
      source: `${block.file}:${block.line}`,
      generated: path.relative(repoRoot, fullPath),
    });
  }

  if (examples.length > 0) {
    fs.writeFileSync(
      path.join(goDir, 'go.mod'),
      [
        'module igris-docs-go-examples',
        '',
        'go 1.21',
        '',
        'require (',
        `\t${context.goModule} v0.0.0`,
        '\tgopkg.in/yaml.v3 v3.0.1',
        ')',
        '',
        `replace ${context.goModule} => ${posixRelative(goDir, context.goRoot)}`,
        '',
      ].join('\n')
    );
    const sdkGoSum = path.join(context.goRoot, 'go.sum');
    if (fs.existsSync(sdkGoSum)) {
      fs.copyFileSync(sdkGoSum, path.join(goDir, 'go.sum'));
    }
  }

  return { dir: goDir, examples };
}

function normalizeRustExample(block, index, context) {
  const crate = context.rustCrate.replace(/-/g, '_');
  let code = block.code.trim();
  const matched = code.includes(crate) || code.includes('IgrisClient');
  if (!matched) {
    return null;
  }
  if (!/\bfn\s+main\s*\(/.test(code)) {
    code = `${code}\n\nfn main() {}`;
  }
  return {
    fileName: `snippet_${index}.rs`,
    code: `${code}\n`,
  };
}

function writeRustExamples(baseDir, blocks, context) {
  const rustDir = path.join(baseDir, 'rust');
  const binDir = path.join(rustDir, 'src', 'bin');
  ensureDir(binDir);
  const examples = [];
  if (!context.rustAvailable || !context.rustRoot) {
    return { dir: rustDir, examples };
  }
  for (const [index, block] of blocks.entries()) {
    if (block.language !== 'rust') {
      continue;
    }
    const example = normalizeRustExample(block, index + 1, context);
    if (!example) {
      continue;
    }
    const fullPath = path.join(binDir, example.fileName);
    fs.writeFileSync(fullPath, example.code);
    examples.push({
      source: `${block.file}:${block.line}`,
      generated: path.relative(repoRoot, fullPath),
    });
  }

  if (examples.length > 0) {
    fs.writeFileSync(
      path.join(rustDir, 'Cargo.toml'),
      [
        '[package]',
        'name = "igris-docs-rust-examples"',
        'version = "0.0.0"',
        'edition = "2021"',
        '',
        '[dependencies]',
        `igris-inertial = { path = "${posixRelative(rustDir, context.rustRoot)}" }`,
        'tokio = { version = "1", features = ["full"] }',
        '',
      ].join('\n')
    );
    const sdkCargoLock = path.join(context.rustRoot, 'Cargo.lock');
    if (fs.existsSync(sdkCargoLock)) {
      fs.copyFileSync(sdkCargoLock, path.join(rustDir, 'Cargo.lock'));
    }
  }

  return { dir: rustDir, examples };
}

function runCompileCommand(label, command, args, options, failures) {
  try {
    execFileSync(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return 'passed';
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
    failures.push(`${label} failed${output ? `:\n${output}` : ''}`);
    return 'failed';
  }
}

function compileGeneratedExamples(blocks, context, failures, warnings) {
  const examplesDir = cleanGeneratedExamples();
  const typescript = writeTypeScriptExamples(examplesDir, blocks, context);
  const go = writeGoExamples(examplesDir, blocks, context);
  const rust = writeRustExamples(examplesDir, blocks, context);
  const results = [];

  if (!context.jsAvailable) {
    warnings.push('Skipping JavaScript SDK snippet compilation; SDK sources are not available in this checkout.');
  }
  if (!context.goAvailable) {
    warnings.push('Skipping Go SDK snippet compilation; SDK sources are not available in this checkout.');
  }
  if (!context.rustAvailable) {
    warnings.push('Skipping Rust SDK snippet compilation; SDK sources are not available in this checkout.');
  }

  if (typescript.examples.length > 0) {
    const tscBin = path.join(docsAppRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    results.push({
      language: 'typescript',
      examples: typescript.examples,
      command: 'tsc --noEmit',
      status: runCompileCommand('TypeScript SDK examples', process.execPath, [tscBin, '--noEmit', '-p', typescript.dir], { cwd: typescript.dir }, failures),
    });
  }
  if (go.examples.length > 0) {
    results.push({
      language: 'go',
      examples: go.examples,
      command: 'go test ./...',
      status: runCompileCommand('Go SDK examples', 'go', ['test', './...'], { cwd: go.dir, env: { GOCACHE: path.join('/tmp', 'igris-docs-go-cache') } }, failures),
    });
  }
  if (rust.examples.length > 0) {
    results.push({
      language: 'rust',
      examples: rust.examples,
      command: 'cargo check',
      status: runCompileCommand('Rust SDK examples', 'cargo', ['check', '--manifest-path', path.join(rust.dir, 'Cargo.toml')], { cwd: rust.dir, env: { CARGO_TARGET_DIR: path.join('/tmp', 'igris-docs-rust-target') } }, failures),
    });
  }

  return results;
}

function main() {
  const failures = [];
  const warnings = [];
  const rows = [];
  const sdkRoots = resolveSdkRoots();
  const jsSdkRow = sdkSupport.rows.find((row) => row.language === 'JavaScript / TypeScript');
  const goSdkRow = sdkSupport.rows.find((row) => row.language === 'Go');
  const rustSdkRow = sdkSupport.rows.find((row) => row.language === 'Rust');
  const jsPackageName = sdkRoots.jsRoot
    ? JSON.parse(read(path.join(sdkRoots.jsRoot, 'package.json'))).name
    : (jsSdkRow?.package ?? '@igris-inertial/sdk');
  const goModule = sdkRoots.goRoot
    ? extractGoModule(sdkRoots.goRoot)
    : (goSdkRow?.package ?? 'github.com/igris-inertial/go-sdk');
  const rustCrate = sdkRoots.rustRoot
    ? read(path.join(sdkRoots.rustRoot, 'Cargo.toml')).match(/^name\s*=\s*"([^"]+)"/m)?.[1]
    : (rustSdkRow?.package ?? 'igris-inertial');
  const context = {
    jsRoot: sdkRoots.jsRoot,
    jsAvailable: Boolean(sdkRoots.jsRoot),
    jsPackageName,
    jsExports: sdkRoots.jsRoot ? extractJsExports(sdkRoots.jsRoot) : new Set(),
    jsClientMethods: sdkRoots.jsRoot
      ? extractClassMethods(read(path.join(sdkRoots.jsRoot, 'src', 'client.ts')), 'IgrisClient')
      : new Set(),
    goRoot: sdkRoots.goRoot,
    goAvailable: Boolean(sdkRoots.goRoot),
    goModule,
    goSymbols: sdkRoots.goRoot ? extractGoSymbols(sdkRoots.goRoot) : { functions: new Set(), methods: new Set(), types: new Set() },
    rustRoot: sdkRoots.rustRoot,
    rustAvailable: Boolean(sdkRoots.rustRoot),
    rustCrate,
    rustExports: sdkRoots.rustRoot ? extractRustExports(sdkRoots.rustRoot) : new Set(),
    rustClientMethods: sdkRoots.rustRoot
      ? extractRustImplMethods(read(path.join(sdkRoots.rustRoot, 'src', 'client.rs')), 'IgrisClient')
      : new Set(),
  };
  if (!context.jsAvailable) {
    warnings.push('JavaScript SDK sources not found; deep JS snippet validation will be skipped.');
  }
  if (!context.goAvailable) {
    warnings.push('Go SDK sources not found; deep Go snippet validation will be skipped.');
  }
  if (!context.rustAvailable) {
    warnings.push('Rust SDK sources not found; deep Rust snippet validation will be skipped.');
  }
  const allBlocks = [];

  for (const docPath of SDK_DOCS) {
    for (const block of extractCodeBlocks(docPath)) {
      allBlocks.push(block);
      const matched = [
        validateJavaScript(block, context, failures),
        validateGo(block, context, failures),
        validateRust(block, context, failures),
      ].some(Boolean);
      if (matched) {
        rows.push({
          file: block.file,
          line: block.line,
          language: block.language,
        });
      }
    }
  }

  const compileResults = compileGeneratedExamples(allBlocks, context, failures, warnings);

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, 'sdk-snippet-validation.json'),
    `${JSON.stringify({ generated_at: new Date().toISOString(), snippets: rows }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(generatedDir, 'sdk-compile-validation.json'),
    `${JSON.stringify({ generated_at: new Date().toISOString(), results: compileResults }, null, 2)}\n`
  );

  if (failures.length > 0) {
    console.error('SDK snippet validation failed:\n');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  for (const warning of warnings) {
    console.warn(`[validate-sdk-snippets] ${warning}`);
  }

  const compiled = compileResults.reduce((count, result) => count + result.examples.length, 0);
  console.log(`SDK snippet validation passed: ${rows.length} JavaScript/Go/Rust snippets checked, ${compiled} generated examples compiled`);
}

main();
