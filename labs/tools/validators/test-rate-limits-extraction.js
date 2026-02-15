#!/usr/bin/env node

/**
 * IGRIS-ENGINE RATE LIMITS SECTION VALIDATION
 * 
 * This script validates the complete extraction and implementation of the rate-limits documentation section.
 * It checks section content, code examples, React components, TypeScript integration, and overall structure.
 */

const fs = require('fs');
const path = require('path');

class RateLimitsValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.testsPassed = 0;
    this.testsTotal = 0;
  }

  test(description, testFn) {
    this.testsTotal++;
    try {
      const result = testFn();
      if (result !== false) {
        console.log(`✅ ${description}`);
        this.testsPassed++;
      } else {
        console.log(`❌ ${description}`);
        this.errors.push(description);
      }
    } catch (error) {
      console.log(`❌ ${description}: ${error.message}`);
      this.errors.push(`${description}: ${error.message}`);
    }
  }

  validateSectionContent() {
    console.log('\n🔍 Validating Rate Limits Section Content...');

    this.test('Rate limits section JSON exists', () => {
      return fs.existsSync('packages/frontend/public/content/documentation/sections/rate-limits.json');
    });

    this.test('Section structure has valid JSON structure', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.title && data.sections && Array.isArray(data.sections);
    });

    this.test('Has rate-limit-overview section', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.sections.some(section => section.type === 'rate-limit-overview');
    });

    this.test('Has rate-limit-handling section', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.sections.some(section => section.type === 'rate-limit-handling');
    });

    this.test('Has rate-limit-monitoring section', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.sections.some(section => section.type === 'rate-limit-monitoring');
    });

    this.test('Rate limits have required properties', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const overviewSection = data.sections.find(s => s.type === 'rate-limit-overview');
      if (!overviewSection || !overviewSection.rateLimits) return false;
      
      return overviewSection.rateLimits.every(limit => 
        limit.tier && limit.description && limit.color && limit.icon && Array.isArray(limit.limits)
      );
    });

    this.test('Has different tier types', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const overviewSection = data.sections.find(s => s.type === 'rate-limit-overview');
      if (!overviewSection || !overviewSection.rateLimits) return false;
      
      const tiers = overviewSection.rateLimits.map(limit => limit.tier);
      return tiers.includes('Free & Pro') && tiers.includes('Enterprise');
    });

    this.test('Handling strategies have required properties', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const handlingSection = data.sections.find(s => s.type === 'rate-limit-handling');
      if (!handlingSection || !handlingSection.handlingStrategies) return false;
      
      return handlingSection.handlingStrategies.every(strategy => 
        strategy.strategy && strategy.description && strategy.color && 
        Array.isArray(strategy.benefits) && Array.isArray(strategy.implementation)
      );
    });

    this.test('Has diverse handling strategies', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const handlingSection = data.sections.find(s => s.type === 'rate-limit-handling');
      if (!handlingSection || !handlingSection.handlingStrategies) return false;
      
      const strategies = handlingSection.handlingStrategies.map(s => s.strategy);
      return strategies.includes('Exponential Backoff') && strategies.includes('Circuit Breaker');
    });

    this.test('Monitoring tools have required properties', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const monitoringSection = data.sections.find(s => s.type === 'rate-limit-monitoring');
      if (!monitoringSection || !monitoringSection.monitoringTools) return false;
      
      return monitoringSection.monitoringTools.every(tool => 
        tool.tool && tool.description && tool.color && tool.icon
      );
    });

    this.test('Has comprehensive monitoring categories', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const monitoringSection = data.sections.find(s => s.type === 'rate-limit-monitoring');
      if (!monitoringSection || !monitoringSection.monitoringTools) return false;
      
      const tools = monitoringSection.monitoringTools.map(t => t.tool);
      return tools.includes('Response Headers') && tools.includes('Usage Analytics');
    });
  }

  validateCodeExamples() {
    console.log('\n📝 Validating Rate Limits Code Examples...');

    this.test('Rate limits code examples JSON exists', () => {
      return fs.existsSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json');
    });

    this.test('Code examples structure has valid JSON structure', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples && Array.isArray(data.examples);
    });

    this.test('Has exponential backoff example', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples.some(ex => ex.title.toLowerCase().includes('exponential backoff'));
    });

    this.test('Has request queue example', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples.some(ex => ex.title.toLowerCase().includes('queue'));
    });

    this.test('Has monitoring example', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples.some(ex => ex.title.toLowerCase().includes('monitoring'));
    });

    this.test('All examples have required fields', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples.every(ex => ex.title && ex.description && ex.language && ex.code);
    });

    this.test('Includes Python implementation', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples.some(ex => ex.language === 'python');
    });

    this.test('Includes JavaScript implementation', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      return data.examples.some(ex => ex.language === 'javascript');
    });

    this.test('Examples show rate limit handling', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      const data = JSON.parse(content);
      const hasRateLimitCode = data.examples.some(ex => 
        ex.code.includes('RateLimitError') || ex.code.includes('429') || ex.code.includes('retry')
      );
      return hasRateLimitCode;
    });
  }

  validateReactComponents() {
    console.log('\n⚛️  Validating React Components...');

    // Rate Limit Overview Component
    this.test('RateLimitOverview.tsx component exists', () => {
      return fs.existsSync('packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx');
    });

    this.test('RateLimitOverview.tsx has proper TypeScript interface', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx', 'utf8');
      return content.includes('interface RateLimitOverviewProps') && content.includes('rateLimits: Array<');
    });

    this.test('RateLimitOverview.tsx uses Lucide icons', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx', 'utf8');
      return content.includes('lucide-react') && (content.includes('Clock') || content.includes('Zap'));
    });

    this.test('RateLimitOverview.tsx has responsive design', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx', 'utf8');
      return content.includes('md:grid-cols') || content.includes('lg:grid-cols');
    });

    this.test('RateLimitOverview.tsx has proper exports', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx', 'utf8');
      return content.includes('export default function RateLimitOverview');
    });

    this.test('RateLimitOverview.tsx has rate limit specific content', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx', 'utf8');
      return content.includes('tier') && content.includes('limits');
    });

    // Rate Limit Handling Component
    this.test('RateLimitHandling.tsx component exists', () => {
      return fs.existsSync('packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx');
    });

    this.test('RateLimitHandling.tsx has proper TypeScript interface', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx', 'utf8');
      return content.includes('interface RateLimitHandlingProps') && content.includes('handlingStrategies: Array<');
    });

    this.test('RateLimitHandling.tsx uses Lucide icons', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx', 'utf8');
      return content.includes('lucide-react') && content.includes('TrendingUp');
    });

    this.test('RateLimitHandling.tsx has responsive design', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx', 'utf8');
      return content.includes('md:grid-cols') || content.includes('lg:grid-cols');
    });

    this.test('RateLimitHandling.tsx has proper exports', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx', 'utf8');
      return content.includes('export default function RateLimitHandling');
    });

    this.test('RateLimitHandling.tsx has handling-specific content', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx', 'utf8');
      return content.includes('strategy') && content.includes('benefits');
    });

    // Rate Limit Monitoring Component
    this.test('RateLimitMonitoring.tsx component exists', () => {
      return fs.existsSync('packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx');
    });

    this.test('RateLimitMonitoring.tsx has proper TypeScript interface', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx', 'utf8');
      return content.includes('interface RateLimitMonitoringProps') && content.includes('monitoringTools: Array<');
    });

    this.test('RateLimitMonitoring.tsx uses Lucide icons', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx', 'utf8');
      return content.includes('lucide-react') && content.includes('BarChart3');
    });

    this.test('RateLimitMonitoring.tsx has responsive design', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx', 'utf8');
      return content.includes('md:grid-cols') || content.includes('lg:grid-cols');
    });

    this.test('RateLimitMonitoring.tsx has proper exports', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx', 'utf8');
      return content.includes('export default function RateLimitMonitoring');
    });

    this.test('RateLimitMonitoring.tsx has monitoring-specific content', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx', 'utf8');
      return content.includes('tool') && (content.includes('headers') || content.includes('metrics'));
    });
  }

  validateTypeScriptIntegration() {
    console.log('\n🔧 Validating TypeScript Integration...');

    this.test('TypeScript types file exists', () => {
      return fs.existsSync('packages/frontend/src/types/documentation.ts');
    });

    this.test('Has rateLimits type definition', () => {
      const content = fs.readFileSync('packages/frontend/src/types/documentation.ts', 'utf8');
      return content.includes('rateLimits?:');
    });

    this.test('Has handlingStrategies type definition', () => {
      const content = fs.readFileSync('packages/frontend/src/types/documentation.ts', 'utf8');
      return content.includes('handlingStrategies?:');
    });

    this.test('Has monitoringTools type definition', () => {
      const content = fs.readFileSync('packages/frontend/src/types/documentation.ts', 'utf8');
      return content.includes('monitoringTools?:');
    });

    this.test('Rate limit types have proper structure', () => {
      const content = fs.readFileSync('packages/frontend/src/types/documentation.ts', 'utf8');
      return content.includes('tier: string') && content.includes('limits: Array<');
    });

    this.test('Component index file exists', () => {
      return fs.existsSync('packages/frontend/src/components/documentation/sections/index.ts');
    });

    this.test('Index exports RateLimitOverview', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/index.ts', 'utf8');
      return content.includes('RateLimitOverview');
    });

    this.test('Index exports RateLimitHandling', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/index.ts', 'utf8');
      return content.includes('RateLimitHandling');
    });

    this.test('Index exports RateLimitMonitoring', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/sections/index.ts', 'utf8');
      return content.includes('RateLimitMonitoring');
    });
  }

  validateContentRendererIntegration() {
    console.log('\n🎨 Validating ContentRenderer Integration...');

    this.test('ContentRenderer component exists', () => {
      return fs.existsSync('packages/frontend/src/components/documentation/ContentRenderer.tsx');
    });

    this.test('ContentRenderer imports rate limit components', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/ContentRenderer.tsx', 'utf8');
      return content.includes('RateLimitOverview') && 
             content.includes('RateLimitHandling') && 
             content.includes('RateLimitMonitoring');
    });

    this.test('Has rate-limit-overview case', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/ContentRenderer.tsx', 'utf8');
      return content.includes("case 'rate-limit-overview':");
    });

    this.test('Has rate-limit-handling case', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/ContentRenderer.tsx', 'utf8');
      return content.includes("case 'rate-limit-handling':");
    });

    this.test('Has rate-limit-monitoring case', () => {
      const content = fs.readFileSync('packages/frontend/src/components/documentation/ContentRenderer.tsx', 'utf8');
      return content.includes("case 'rate-limit-monitoring':");
    });
  }

  validateOverallStructure() {
    console.log('\n🏗️  Validating Overall Structure...');

    this.test('All required files exist', () => {
      const requiredFiles = [
        'packages/frontend/public/content/documentation/sections/rate-limits.json',
        'packages/frontend/public/content/documentation/code-examples/rate-limits.json',
        'packages/frontend/src/components/documentation/sections/RateLimitOverview.tsx',
        'packages/frontend/src/components/documentation/sections/RateLimitHandling.tsx',
        'packages/frontend/src/components/documentation/sections/RateLimitMonitoring.tsx'
      ];
      return requiredFiles.every(file => fs.existsSync(file));
    });

    this.test('Files have appropriate content length', () => {
      const sectionContent = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      const codeContent = fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rate-limits.json', 'utf8');
      return sectionContent.length > 1000 && codeContent.length > 1000;
    });

    this.test('Section focuses on rate limits', () => {
      const content = fs.readFileSync('packages/frontend/public/content/documentation/sections/rate-limits.json', 'utf8');
      return content.toLowerCase().includes('rate limit') || content.toLowerCase().includes('throttling');
    });
  }

  generateReport() {
    console.log('\n📊 RATE LIMITS EXTRACTION VALIDATION REPORT');
    console.log('='.repeat(65));
    
    console.log('\n📋 Summary:');
    console.log(`   Total Tests: ${this.testsTotal}`);
    console.log(`   Passed: ${this.testsPassed}`);
    console.log(`   Failed: ${this.testsTotal - this.testsPassed}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    console.log(`   Success Rate: ${((this.testsPassed / this.testsTotal) * 100).toFixed(1)}%`);

    if (this.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    const successRate = (this.testsPassed / this.testsTotal) * 100;
    
    if (successRate >= 95) {
      console.log('\n✅ Rate Limits Focus Areas:');
      console.log('   • Rate limit tier structure with comprehensive quotas');
      console.log('   • Advanced handling strategies (exponential backoff, circuit breaker)');
      console.log('   • Real-time monitoring and proactive alerting');
      console.log('   • Production-ready code examples and implementations');
      console.log('\n🎉 RATE LIMITS EXTRACTION SUCCESSFUL!');
      console.log('All rate limit components are properly implemented and integrated.');
    } else if (successRate >= 80) {
      console.log('\n⚠️  RATE LIMITS EXTRACTION MOSTLY SUCCESSFUL');
      console.log('Some minor issues found. Please review the failed tests above.');
    } else {
      console.log('\n❌ RATE LIMITS EXTRACTION NEEDS ATTENTION');
      console.log('Significant issues found. Please address the failed tests above.');
    }

    return successRate >= 95;
  }

  async run() {
    console.log('✅ IGRIS-ENGINE RATE LIMITS SECTION VALIDATION');
    console.log('Starting comprehensive validation of rate limits extraction...\n');

    this.validateSectionContent();
    this.validateCodeExamples();
    this.validateReactComponents();
    this.validateTypeScriptIntegration();
    this.validateContentRendererIntegration();
    this.validateOverallStructure();

    return this.generateReport();
  }
}

// Run the validation
const validator = new RateLimitsValidator();
validator.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
}); 