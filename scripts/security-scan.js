#!/usr/bin/env node

/**
 * Security Vulnerability Scanner
 * Scans for security vulnerabilities and provides detailed reporting
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { findWorkspacePackages } = require('@pnpm/find-workspace-packages');

class SecurityScanner {
  constructor() {
    this.vulnerabilities = [];
    this.packages = [];
    this.config = this.loadConfig();
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), '.security-scan.json');
    const defaultConfig = {
      skipPackages: [],
      ignoreCVEs: [],
      severityThresholds: {
        critical: 0,
        high: 0,
        moderate: 10,
        low: 50
      },
      outputFormats: ['console', 'json'],
      reportPath: './security-reports'
    };

    if (fs.existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.log(chalk.yellow('⚠️ Invalid security config, using defaults'));
        return defaultConfig;
      }
    }

    return defaultConfig;
  }

  async scanDependencies() {
    console.log(chalk.blue('🔍 Scanning dependencies for security vulnerabilities...\n'));

    try {
      // Get workspace packages
      this.packages = await findWorkspacePackages(process.cwd());

      // Run pnpm audit
      const auditResult = await this.runAudit();

      // Parse vulnerabilities
      this.parseAuditResults(auditResult);

      // Generate reports
      await this.generateReports();

      return this.assessSecurityPosture();

    } catch (error) {
      console.error(chalk.red('❌ Security scan failed:'), error.message);
      throw error;
    }
  }

  async runAudit() {
    console.log(chalk.blue('📋 Running pnpm audit...'));

    try {
      const auditOutput = execSync('pnpm audit --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return JSON.parse(auditOutput);
    } catch (error) {
      // pnpm audit exits with non-zero when vulnerabilities are found
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch (parseError) {
          console.log(chalk.yellow('⚠️ Could not parse audit output, using raw format'));
          return { vulnerabilities: [], summary: { total: 0 } };
        }
      }
      throw error;
    }
  }

  parseAuditResults(auditResult) {
    if (!auditResult || !auditResult.advisories) {
      console.log(chalk.green('✅ No vulnerabilities found in audit'));
      return;
    }

    const advisories = auditResult.advisories;

    for (const [id, advisory] of Object.entries(advisories)) {
      // Skip ignored CVEs
      if (this.config.ignoreCVEs.includes(advisory.cves?.[0])) {
        continue;
      }

      const vulnerability = {
        id,
        title: advisory.title,
        severity: advisory.severity,
        package: advisory.module_name,
        version: advisory.vulnerable_versions,
        patchedVersion: advisory.patched_versions,
        cves: advisory.cves || [],
        url: advisory.url,
        recommendation: advisory.recommendation,
        paths: advisory.findings?.map(f => f.paths).flat() || []
      };

      this.vulnerabilities.push(vulnerability);
    }
  }

  assessSecurityPosture() {
    const severityCounts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0
    };

    this.vulnerabilities.forEach(vuln => {
      severityCounts[vuln.severity] = (severityCounts[vuln.severity] || 0) + 1;
    });

    console.log(chalk.blue('\n📊 Security Assessment Summary:'));
    console.log(`   Total vulnerabilities: ${this.vulnerabilities.length}`);

    Object.entries(severityCounts).forEach(([severity, count]) => {
      if (count > 0) {
        const color = this.getSeverityColor(severity);
        console.log(color(`   ${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${count}`));
      }
    });

    // Check against thresholds
    const thresholds = this.config.severityThresholds;
    const failed = [];

    Object.entries(thresholds).forEach(([severity, threshold]) => {
      const count = severityCounts[severity] || 0;
      if (count > threshold) {
        failed.push(`${severity}: ${count} > ${threshold}`);
      }
    });

    if (failed.length > 0) {
      console.log(chalk.red('\n❌ Security thresholds exceeded:'));
      failed.forEach(failure => console.log(chalk.red(`   ${failure}`)));
      return false;
    }

    if (this.vulnerabilities.length === 0) {
      console.log(chalk.green('\n🎉 No security vulnerabilities found!'));
    } else {
      console.log(chalk.green('\n✅ All vulnerabilities within acceptable thresholds'));
    }

    return true;
  }

  getSeverityColor(severity) {
    const colors = {
      critical: chalk.bgRed.white,
      high: chalk.red,
      moderate: chalk.yellow,
      low: chalk.blue,
      info: chalk.gray
    };
    return colors[severity] || chalk.white;
  }

  async generateReports() {
    if (!fs.existsSync(this.config.reportPath)) {
      fs.mkdirSync(this.config.reportPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // JSON Report
    if (this.config.outputFormats.includes('json')) {
      const jsonReport = {
        timestamp: new Date().toISOString(),
        scanConfig: this.config,
        packages: this.packages.map(p => ({ name: p.manifest.name, version: p.manifest.version })),
        vulnerabilities: this.vulnerabilities,
        summary: this.getSummary()
      };

      const jsonPath = path.join(this.config.reportPath, `security-scan-${timestamp}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
      console.log(chalk.blue(`📄 JSON report saved: ${jsonPath}`));
    }

    // HTML Report (basic)
    if (this.config.outputFormats.includes('html')) {
      const htmlContent = this.generateHTMLReport(timestamp);
      const htmlPath = path.join(this.config.reportPath, `security-scan-${timestamp}.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(chalk.blue(`📄 HTML report saved: ${htmlPath}`));
    }
  }

  getSummary() {
    const severityCounts = {};
    this.vulnerabilities.forEach(vuln => {
      severityCounts[vuln.severity] = (severityCounts[vuln.severity] || 0) + 1;
    });

    return {
      total: this.vulnerabilities.length,
      by_severity: severityCounts,
      packages_scanned: this.packages.length
    };
  }

  generateHTMLReport(timestamp) {
    const summary = this.getSummary();

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .vulnerability { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .critical { border-left: 5px solid #dc3545; }
        .high { border-left: 5px solid #fd7e14; }
        .moderate { border-left: 5px solid #ffc107; }
        .low { border-left: 5px solid #17a2b8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Vulnerability Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Scan Target: Schlep-engine Monorepo</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>${summary.total}</h3>
            <p>Total Vulnerabilities</p>
        </div>
        <div class="metric">
            <h3>${summary.packages_scanned}</h3>
            <p>Packages Scanned</p>
        </div>
        ${Object.entries(summary.by_severity).map(([severity, count]) => `
        <div class="metric">
            <h3>${count}</h3>
            <p>${severity.charAt(0).toUpperCase() + severity.slice(1)}</p>
        </div>
        `).join('')}
    </div>

    <h2>Vulnerabilities</h2>
    ${this.vulnerabilities.map(vuln => `
    <div class="vulnerability ${vuln.severity}">
        <h3>${vuln.title}</h3>
        <p><strong>Package:</strong> ${vuln.package}</p>
        <p><strong>Severity:</strong> ${vuln.severity}</p>
        <p><strong>Vulnerable Versions:</strong> ${vuln.version}</p>
        <p><strong>Patched Versions:</strong> ${vuln.patchedVersion}</p>
        ${vuln.cves.length > 0 ? `<p><strong>CVEs:</strong> ${vuln.cves.join(', ')}</p>` : ''}
        <p><strong>Recommendation:</strong> ${vuln.recommendation}</p>
        ${vuln.url ? `<p><a href="${vuln.url}" target="_blank">More Info</a></p>` : ''}
    </div>
    `).join('')}
</body>
</html>`;
  }
}

async function runSecurityScan() {
  const scanner = new SecurityScanner();

  try {
    const passed = await scanner.scanDependencies();
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('❌ Security scan failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runSecurityScan();
}

module.exports = { SecurityScanner };