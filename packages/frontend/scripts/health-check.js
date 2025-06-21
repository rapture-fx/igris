#!/usr/bin/env node

/**
 * Sherringford Web Health Check Script
 * 
 * This script performs automated health checks to prevent integration issues.
 * Run with: node scripts/health-check.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }
    return null;
  }
}

async function runHealthCheck() {
  log('\n🔍 Sherringford Web Health Check Starting...', 'cyan');
  log('================================================', 'cyan');

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  const checks = [
    {
      name: 'Node.js Version Check',
      test: () => {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion >= 18) {
          log(` Node.js ${nodeVersion} (✓ >= 18.0.0)`, 'green');
          return true;
        } else {
          log(` Node.js ${nodeVersion} (✗ < 18.0.0)`, 'red');
          return false;
        }
      }
    },
    {
      name: 'pnpm Installation Check',
      test: () => {
        try {
          const pnpmVersion = exec('pnpm --version', { silent: true });
          log(` pnpm ${pnpmVersion.trim()}`, 'green');
          return true;
        } catch {
          log(' pnpm not installed or not in PATH', 'red');
          return false;
        }
      }
    },
    {
      name: 'Package.json Validation',
      test: () => {
        try {
          const packageJson = require('../package.json');
          const requiredFields = ['name', 'version', 'scripts', 'dependencies'];
          const missing = requiredFields.filter(field => !packageJson[field]);
          
          if (missing.length === 0) {
            log(' package.json structure valid', 'green');
            return true;
          } else {
            log(` package.json missing fields: ${missing.join(', ')}`, 'red');
            return false;
          }
        } catch {
          log(' package.json not found or invalid JSON', 'red');
          return false;
        }
      }
    },
    {
      name: 'Dependencies Installation Check',
      test: () => {
        const nodeModulesExists = fs.existsSync('node_modules');
        if (nodeModulesExists) {
          log(' node_modules directory exists', 'green');
          return true;
        } else {
          log(' node_modules directory missing', 'red');
          log('   💡 Run: pnpm run fresh-install', 'yellow');
          return false;
        }
      }
    },
    {
      name: 'TypeScript Configuration Check',
      test: () => {
        try {
          require('../tsconfig.json');
          log(' tsconfig.json valid', 'green');
          return true;
        } catch {
          log(' tsconfig.json not found or invalid', 'red');
          return false;
        }
      }
    },
    {
      name: 'TypeScript Compilation Check',
      test: () => {
        try {
          exec('pnpm run type-check', { silent: true });
          log(' TypeScript compilation successful', 'green');
          return true;
        } catch {
          log(' TypeScript compilation errors detected', 'red');
          log('   💡 Run: pnpm run type-check', 'yellow');
          return false;
        }
      }
    },
    {
      name: 'ESLint Configuration Check',
      test: () => {
        try {
          exec('pnpm run lint', { silent: true });
          log(' ESLint checks passed', 'green');
          return true;
        } catch {
          log('WARNING  ESLint issues detected', 'yellow');
          log('   💡 Run: pnpm run lint:fix', 'yellow');
          warnings++;
          return null; // Don't count as pass or fail
        }
      }
    },
    {
      name: 'Next.js Configuration Check',
      test: () => {
        try {
          require('../next.config.js');
          log(' next.config.js valid', 'green');
          return true;
        } catch {
          log(' next.config.js not found or invalid', 'red');
          return false;
        }
      }
    },
    {
      name: 'Tailwind Configuration Check',
      test: () => {
        try {
          require('../tailwind.config.js');
          log(' tailwind.config.js valid', 'green');
          return true;
        } catch {
          log(' tailwind.config.js not found or invalid', 'red');
          return false;
        }
      }
    },
    {
      name: 'Build Test',
      test: () => {
        try {
          log('   Building application (this may take a moment)...', 'blue');
          exec('pnpm run build', { silent: true });
          log(' Production build successful', 'green');
          return true;
        } catch {
          log(' Production build failed', 'red');
          log('   💡 Run: pnpm run build:clean', 'yellow');
          return false;
        }
      }
    },
    {
      name: 'Cache Directory Check',
      test: () => {
        const cacheDir = '.next';
        if (fs.existsSync(cacheDir)) {
          const stats = fs.statSync(cacheDir);
          const ageMs = Date.now() - stats.mtime.getTime();
          const ageHours = ageMs / (1000 * 60 * 60);
          
          if (ageHours > 24) {
            log('WARNING  Build cache is older than 24 hours', 'yellow');
            log('   💡 Consider running: pnpm run clean', 'yellow');
            warnings++;
            return null;
          } else {
            log(' Build cache is fresh', 'green');
            return true;
          }
        } else {
          log(' No build cache (clean state)', 'green');
          return true;
        }
      }
    }
  ];

  log('\n🧪 Running Health Checks...', 'cyan');
  log('------------------------------', 'cyan');

  for (const check of checks) {
    log(`\n📋 ${check.name}:`);
    const result = check.test();
    if (result === true) {
      passed++;
    } else if (result === false) {
      failed++;
    }
  }

  // Summary
  log('\n Health Check Summary:', 'cyan');
  log('========================', 'cyan');
  log(` Passed: ${passed}`, 'green');
  log(` Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`WARNING  Warnings: ${warnings}`, warnings > 0 ? 'yellow' : 'green');

  const total = passed + failed;
  const successRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
  log(` Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');

  // Recommendations
  if (failed > 0 || warnings > 0) {
    log('\n Recommended Actions:', 'yellow');
    log('------------------------', 'yellow');
    
    if (failed > 0) {
      log('1. Fix critical issues first ()', 'yellow');
      log('2. Run: pnpm run fresh-install', 'yellow');
      log('3. Re-run health check', 'yellow');
    }
    
    if (warnings > 0) {
      log('1. Address warnings (WARNING)', 'yellow');
      log('2. Run: pnpm run lint:fix', 'yellow');
      log('3. Run: pnpm run clean (if cache issues)', 'yellow');
    }
  }

  // Quick fix commands
  if (failed > 0) {
    log('\n Quick Fix Commands:', 'blue');
    log('---------------------', 'blue');
    log('pnpm run fresh-install  # Fresh dependency installation', 'white');
    log('pnpm run clean          # Clear build cache', 'white');
    log('pnpm run lint:fix       # Auto-fix linting issues', 'white');
    log('pnpm run type-check     # Check TypeScript errors', 'white');
  }

  log('\n System Status:', 'cyan');
  if (failed === 0 && warnings === 0) {
    log(' HEALTHY - All systems operational!', 'green');
  } else if (failed === 0 && warnings > 0) {
    log(' WARNING - Some issues detected but system functional', 'yellow');
  } else {
    log(' CRITICAL - System has issues that need attention', 'red');
  }

  log('\n💡 For detailed troubleshooting, see: DEVELOPMENT.md', 'blue');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run the health check
runHealthCheck().catch(error => {
  log(`\n Health check failed with error: ${error.message}`, 'red');
  process.exit(1);
}); 