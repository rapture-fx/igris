#!/usr/bin/env node

/**
 * Dependency Version Synchronizer
 * Synchronizes dependency versions across all packages in the monorepo
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { findWorkspacePackages } = require('@pnpm/find-workspace-packages');

async function syncDependencyVersions() {
  console.log(chalk.blue('🔄 Synchronizing dependency versions across monorepo...\n'));

  try {
    // Get root package.json for reference versions
    const rootPackagePath = path.join(process.cwd(), 'package.json');
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
    const referenceVersions = rootPackage.dependencyVersions || {};

    if (Object.keys(referenceVersions).length === 0) {
      console.log(chalk.yellow('⚠️ No reference versions found in root package.json'));
      console.log(chalk.yellow('   Add dependencyVersions section to root package.json first'));
      return false;
    }

    // Find all workspace packages
    const packages = await findWorkspacePackages(process.cwd());

    let updatedPackages = 0;
    let totalUpdates = 0;

    for (const pkg of packages) {
      const packageJsonPath = path.join(pkg.dir, 'package.json');
      const packageJson = pkg.manifest;
      let packageUpdated = false;

      // Check dependencies, devDependencies, and peerDependencies
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'];

      for (const depType of depTypes) {
        const deps = packageJson[depType];
        if (!deps) continue;

        for (const [depName, currentVersion] of Object.entries(deps)) {
          const referenceVersion = referenceVersions[depName];

          if (referenceVersion && currentVersion !== referenceVersion) {
            console.log(chalk.yellow(`📦 ${pkg.manifest.name}:`));
            console.log(chalk.yellow(`   ${depName}: ${currentVersion} → ${referenceVersion}`));

            deps[depName] = referenceVersion;
            packageUpdated = true;
            totalUpdates++;
          }
        }
      }

      // Write updated package.json
      if (packageUpdated) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        updatedPackages++;
      }
    }

    console.log();
    console.log(chalk.green(`✅ Updated ${totalUpdates} dependencies across ${updatedPackages} packages`));

    if (totalUpdates > 0) {
      console.log();
      console.log(chalk.blue('💡 Next steps:'));
      console.log(chalk.blue('   1. Run `pnpm install` to update lockfiles'));
      console.log(chalk.blue('   2. Test your applications to ensure compatibility'));
      console.log(chalk.blue('   3. Commit the changes'));
    }

    return true;

  } catch (error) {
    console.error(chalk.red('❌ Error synchronizing dependencies:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  syncDependencyVersions().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { syncDependencyVersions };