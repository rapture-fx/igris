#!/usr/bin/env node

/**
 * Dependency Version Consistency Checker
 * Ensures all packages in the monorepo use consistent dependency versions
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { findWorkspacePackages } = require('@pnpm/find-workspace-packages');
const semver = require('semver');

async function checkDependencyConsistency() {
  console.log(chalk.blue('🔍 Checking dependency version consistency across monorepo...\n'));

  try {
    // Get root package.json for reference versions
    const rootPackagePath = path.join(process.cwd(), 'package.json');
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
    const referenceVersions = rootPackage.dependencyVersions || {};

    // Find all workspace packages
    const packages = await findWorkspacePackages(process.cwd());

    const issues = [];
    const versionMap = new Map();

    // Collect all dependency versions
    for (const pkg of packages) {
      const packageJson = pkg.manifest;
      const packagePath = pkg.dir;
      const packageName = packageJson.name;

      // Check dependencies, devDependencies, and peerDependencies
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'];

      for (const depType of depTypes) {
        const deps = packageJson[depType] || {};

        for (const [depName, version] of Object.entries(deps)) {
          const key = `${depName}:${depType}`;

          if (!versionMap.has(key)) {
            versionMap.set(key, []);
          }

          versionMap.get(key).push({
            package: packageName,
            version,
            path: packagePath
          });
        }
      }
    }

    // Check for version conflicts
    for (const [depKey, usages] of versionMap) {
      const [depName, depType] = depKey.split(':');
      const versions = [...new Set(usages.map(u => u.version))];

      if (versions.length > 1) {
        // Check if reference version exists
        const referenceVersion = referenceVersions[depName];
        const hasReference = !!referenceVersion;

        issues.push({
          dependency: depName,
          type: depType,
          versions,
          usages,
          hasReference,
          referenceVersion,
          severity: hasReference ? 'warning' : 'error'
        });
      }
    }

    // Check for missing reference versions
    const allDependencies = new Set();
    for (const [depKey] of versionMap) {
      const [depName] = depKey.split(':');
      allDependencies.add(depName);
    }

    const missingReferences = [];
    for (const dep of allDependencies) {
      if (!referenceVersions[dep] && !dep.startsWith('@schlep-engine/')) {
        missingReferences.push(dep);
      }
    }

    // Report results
    console.log(chalk.green(`✅ Scanned ${packages.length} packages`));
    console.log(chalk.green(`✅ Found ${versionMap.size} unique dependencies\n`));

    if (issues.length === 0 && missingReferences.length === 0) {
      console.log(chalk.green('🎉 All dependencies are consistent!'));
      return true;
    }

    // Report version conflicts
    if (issues.length > 0) {
      console.log(chalk.red(`❌ Found ${issues.length} version conflicts:\n`));

      for (const issue of issues) {
        const icon = issue.severity === 'error' ? '🚨' : '⚠️';
        const color = issue.severity === 'error' ? chalk.red : chalk.yellow;

        console.log(color(`${icon} ${issue.dependency} (${issue.type}):`));

        if (issue.hasReference) {
          console.log(color(`   Reference: ${issue.referenceVersion}`));
        }

        for (const usage of issue.usages) {
          const marker = issue.hasReference && usage.version !== issue.referenceVersion ? '❌' : '📦';
          console.log(`   ${marker} ${usage.package}: ${usage.version}`);
        }
        console.log();
      }
    }

    // Report missing references
    if (missingReferences.length > 0) {
      console.log(chalk.yellow(`⚠️ Missing reference versions for ${missingReferences.length} dependencies:`));
      for (const dep of missingReferences.slice(0, 10)) { // Show first 10
        console.log(chalk.yellow(`   - ${dep}`));
      }
      if (missingReferences.length > 10) {
        console.log(chalk.yellow(`   ... and ${missingReferences.length - 10} more`));
      }
      console.log();
    }

    // Provide recommendations
    console.log(chalk.blue('💡 Recommendations:'));
    console.log(chalk.blue('   1. Add missing dependencies to dependencyVersions in root package.json'));
    console.log(chalk.blue('   2. Run `pnpm deps:sync` to synchronize versions'));
    console.log(chalk.blue('   3. Use `pnpm deps:update` to update to latest versions'));

    return false;

  } catch (error) {
    console.error(chalk.red('❌ Error checking dependencies:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkDependencyConsistency().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { checkDependencyConsistency };