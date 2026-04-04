const fs = require('fs');
const path = require('path');

const { bannedPatterns, docsDir, generatedDir } = require('./docs-data');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const failures = [];

  const requiredGeneratedFiles = ['api-reference.json', 'api-verification.json', 'sdk-support.json'];
  for (const fileName of requiredGeneratedFiles) {
    const fullPath = path.join(generatedDir, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`Missing generated artifact: ${fullPath}`);
    }
  }

  for (const filePath of walk(docsDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rule of bannedPatterns) {
      const matched = rule.pattern instanceof RegExp
        ? rule.pattern.test(content)
        : content.includes(rule.pattern);
      if (matched) {
        failures.push(`${filePath}: ${rule.message}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Documentation validation failed:\n');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Documentation validation passed');
}

main();
