#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI colors for terminal output
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

class ObservabilityExtractionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  log(message, color = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
  }

  error(message) {
    this.errors.push(message);
    this.log(`❌ ERROR: ${message}`, colors.red);
  }

  warning(message) {
    this.warnings.push(message);
    this.log(`⚠️  WARNING: ${message}`, colors.yellow);
  }

  success(message) {
    this.passedTests++;
    this.log(`✅ ${message}`, colors.green);
  }

  test(description, testFn) {
    this.totalTests++;
    try {
      const result = testFn();
      if (result) {
        this.success(description);
      } else {
        this.error(`${description} - Test failed`);
      }
    } catch (err) {
      this.error(`${description} - ${err.message}`);
    }
  }

  validateFileExists(filePath, description) {
    this.test(`${description} exists`, () => {
      return fs.existsSync(filePath);
    });
  }

  validateJSONStructure(filePath, requiredFields, description) {
    this.test(`${description} has valid JSON structure`, () => {
      if (!fs.existsSync(filePath)) return false;
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return requiredFields.every(field => {
        const hasField = content.hasOwnProperty(field);
        if (!hasField) {
          this.warning(`Missing field: ${field} in ${path.basename(filePath)}`);
        }
        return hasField;
      });
    });
  }

  validateSectionContent(sectionPath) {
    this.log(`\n${colors.cyan}🔍 Validating Observability Section Content...${colors.reset}`);
    
    this.validateFileExists(sectionPath, 'Observability section JSON');
    
    if (fs.existsSync(sectionPath)) {
      const content = JSON.parse(fs.readFileSync(sectionPath, 'utf8'));
      
      // Validate main structure
      this.validateJSONStructure(sectionPath, ['sections'], 'Section structure');
      
      if (content.sections) {
        // Test observability features section
        this.test('Has observability-features section', () => {
          return content.sections.some(section => section.type === 'observability-features');
        });
        
        // Test monitoring stack section
        this.test('Has monitoring-stack section', () => {
          return content.sections.some(section => section.type === 'monitoring-stack');
        });
        
        // Test observability metrics section
        this.test('Has observability-metrics section', () => {
          return content.sections.some(section => section.type === 'observability-metrics');
        });
        
        // Validate observability features data
        const featuresSection = content.sections.find(s => s.type === 'observability-features');
        if (featuresSection) {
          this.test('Observability features have required properties', () => {
            return featuresSection.observabilityFeatures && 
                   featuresSection.observabilityFeatures.every(feature => 
                     feature.name && feature.description && feature.color && 
                     feature.icon && feature.capabilities
                   );
          });
          
          this.test('Has at least 3 observability features', () => {
            return featuresSection.observabilityFeatures && 
                   featuresSection.observabilityFeatures.length >= 3;
          });
        }
        
        // Validate monitoring stack data
        const stackSection = content.sections.find(s => s.type === 'monitoring-stack');
        if (stackSection) {
          this.test('Monitoring stack has required properties', () => {
            return stackSection.monitoringStack && 
                   stackSection.monitoringStack.every(stack => 
                     stack.category && stack.description && stack.tools
                   );
          });
          
          this.test('Monitoring tools have required properties', () => {
            return stackSection.monitoringStack && 
                   stackSection.monitoringStack.every(stack => 
                     stack.tools.every(tool => 
                       tool.name && tool.purpose && tool.integration
                     )
                   );
          });
        }
        
        // Validate observability metrics data
        const metricsSection = content.sections.find(s => s.type === 'observability-metrics');
        if (metricsSection) {
          this.test('Observability metrics have required properties', () => {
            return metricsSection.observabilityMetrics && 
                   metricsSection.observabilityMetrics.every(metric => 
                     metric.category && metric.color && metric.icon && metric.metrics
                   );
          });
          
          this.test('Has comprehensive metric categories', () => {
            if (!metricsSection.observabilityMetrics) return false;
            const categories = metricsSection.observabilityMetrics.map(m => m.category.toLowerCase());
            return categories.some(cat => cat.includes('performance')) &&
                   categories.some(cat => cat.includes('quality')) &&
                   categories.some(cat => cat.includes('business'));
          });
        }
      }
    }
  }

  validateCodeExamples(codeExamplesPath) {
    this.log(`\n${colors.cyan}📝 Validating Observability Code Examples...${colors.reset}`);
    
    this.validateFileExists(codeExamplesPath, 'Observability code examples JSON');
    
    if (fs.existsSync(codeExamplesPath)) {
      const content = JSON.parse(fs.readFileSync(codeExamplesPath, 'utf8'));
      
      this.validateJSONStructure(codeExamplesPath, ['examples'], 'Code examples structure');
      
      if (content.examples) {
        this.test('Has production monitoring example', () => {
          return content.examples.some(ex => 
            ex.id.includes('production-monitoring') || 
            ex.title.toLowerCase().includes('monitoring')
          );
        });
        
        this.test('Has dashboard integration example', () => {
          return content.examples.some(ex => 
            ex.id.includes('dashboard') || 
            ex.title.toLowerCase().includes('dashboard')
          );
        });
        
        this.test('Has metrics collection example', () => {
          return content.examples.some(ex => 
            ex.id.includes('metrics') || 
            ex.title.toLowerCase().includes('metrics')
          );
        });
        
        // Validate example structure
        this.test('All examples have required fields', () => {
          return content.examples.every(example => 
            example.id && example.title && example.description && 
            example.language && example.code && example.response
          );
        });
        
        // Check for comprehensive code coverage
        this.test('Includes Python monitoring setup', () => {
          return content.examples.some(ex => 
            ex.language === 'python' && ex.code.includes('MetricsCollector')
          );
        });
        
        this.test('Includes JavaScript observability code', () => {
          return content.examples.some(ex => 
            ex.language === 'javascript' && ex.code.length > 1000
          );
        });
      }
    }
  }

  validateReactComponents() {
    this.log(`\n${colors.cyan}⚛️  Validating React Components...${colors.reset}`);
    
    const componentPaths = [
      'packages/frontend/src/components/documentation/sections/ObservabilityFeatures.tsx',
      'packages/frontend/src/components/documentation/sections/MonitoringStack.tsx',
      'packages/frontend/src/components/documentation/sections/ObservabilityMetrics.tsx'
    ];
    
    componentPaths.forEach(componentPath => {
      this.validateFileExists(componentPath, `${path.basename(componentPath)} component`);
      
      if (fs.existsSync(componentPath)) {
        const content = fs.readFileSync(componentPath, 'utf8');
        
        this.test(`${path.basename(componentPath)} has proper TypeScript interface`, () => {
          return content.includes('interface') && content.includes('Props');
        });
        
        this.test(`${path.basename(componentPath)} uses Lucide icons`, () => {
          return content.includes('lucide-react');
        });
        
        this.test(`${path.basename(componentPath)} has responsive design`, () => {
          return content.includes('md:') || content.includes('grid');
        });
        
        this.test(`${path.basename(componentPath)} has proper exports`, () => {
          return content.includes('export') && content.includes('default');
        });
      }
    });
  }

  validateTypeScriptIntegration() {
    this.log(`\n${colors.cyan}🔧 Validating TypeScript Integration...${colors.reset}`);
    
    const typesPath = 'packages/frontend/src/types/documentation.ts';
    this.validateFileExists(typesPath, 'TypeScript types file');
    
    if (fs.existsSync(typesPath)) {
      const content = fs.readFileSync(typesPath, 'utf8');
      
      this.test('Has observabilityFeatures type definition', () => {
        return content.includes('observabilityFeatures?:');
      });
      
      this.test('Has monitoringStack type definition', () => {
        return content.includes('monitoringStack?:');
      });
      
      this.test('Has observabilityMetrics type definition', () => {
        return content.includes('observabilityMetrics?:');
      });
      
      this.test('Type definitions have proper structure', () => {
        return content.includes('Array<{') && content.includes('string;');
      });
    }
    
    // Check index.ts exports
    const indexPath = 'packages/frontend/src/components/documentation/sections/index.ts';
    this.validateFileExists(indexPath, 'Component index file');
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      
      this.test('Index exports ObservabilityFeatures', () => {
        return content.includes('ObservabilityFeatures');
      });
      
      this.test('Index exports MonitoringStack', () => {
        return content.includes('MonitoringStack');
      });
      
      this.test('Index exports ObservabilityMetrics', () => {
        return content.includes('ObservabilityMetrics');
      });
    }
  }

  validateContentRenderer() {
    this.log(`\n${colors.cyan}🎨 Validating ContentRenderer Integration...${colors.reset}`);
    
    const rendererPath = 'packages/frontend/src/components/documentation/ContentRenderer.tsx';
    this.validateFileExists(rendererPath, 'ContentRenderer component');
    
    if (fs.existsSync(rendererPath)) {
      const content = fs.readFileSync(rendererPath, 'utf8');
      
      this.test('ContentRenderer imports observability components', () => {
        return content.includes('ObservabilityFeatures') && 
               content.includes('MonitoringStack') && 
               content.includes('ObservabilityMetrics');
      });
      
      this.test('Has observability-features case', () => {
        return content.includes("case 'observability-features':");
      });
      
      this.test('Has monitoring-stack case', () => {
        return content.includes("case 'monitoring-stack':");
      });
      
      this.test('Has observability-metrics case', () => {
        return content.includes("case 'observability-metrics':");
      });
    }
  }

  validateOverallStructure() {
    this.log(`\n${colors.cyan}🏗️  Validating Overall Structure...${colors.reset}`);
    
    const requiredFiles = [
      'packages/frontend/public/content/documentation/sections/observability.json',
      'packages/frontend/public/content/documentation/code-examples/observability.json',
      'packages/frontend/src/components/documentation/sections/ObservabilityFeatures.tsx',
      'packages/frontend/src/components/documentation/sections/MonitoringStack.tsx',
      'packages/frontend/src/components/documentation/sections/ObservabilityMetrics.tsx'
    ];
    
    this.test('All required files exist', () => {
      return requiredFiles.every(file => {
        const exists = fs.existsSync(file);
        if (!exists) {
          this.warning(`Missing file: ${file}`);
        }
        return exists;
      });
    });
    
    this.test('Files have appropriate content length', () => {
      return requiredFiles.every(file => {
        if (!fs.existsSync(file)) return false;
        const content = fs.readFileSync(file, 'utf8');
        return content.length > 100; // Basic content check
      });
    });
  }

  generateReport() {
    this.log(`\n${colors.magenta}📊 OBSERVABILITY EXTRACTION VALIDATION REPORT${colors.reset}`);
    this.log(`${'='.repeat(60)}`);
    
    this.log(`${colors.cyan}📋 Summary:${colors.reset}`);
    this.log(`   Total Tests: ${this.totalTests}`);
    this.log(`   Passed: ${colors.green}${this.passedTests}${colors.reset}`);
    this.log(`   Failed: ${colors.red}${this.totalTests - this.passedTests}${colors.reset}`);
    this.log(`   Warnings: ${colors.yellow}${this.warnings.length}${colors.reset}`);
    
    const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
    this.log(`   Success Rate: ${successRate >= 90 ? colors.green : successRate >= 70 ? colors.yellow : colors.red}${successRate}%${colors.reset}`);
    
    if (this.errors.length > 0) {
      this.log(`\n${colors.red}❌ Errors:${colors.reset}`);
      this.errors.forEach(error => this.log(`   • ${error}`));
    }
    
    if (this.warnings.length > 0) {
      this.log(`\n${colors.yellow}⚠️  Warnings:${colors.reset}`);
      this.warnings.forEach(warning => this.log(`   • ${warning}`));
    }
    
    this.log(`\n${colors.cyan}🎯 Focus Areas:${colors.reset}`);
    this.log(`   • Comprehensive monitoring capabilities`);
    this.log(`   • Real-time observability features`);
    this.log(`   • Integration with industry tools`);
    this.log(`   • Business and technical metrics`);
    
    if (successRate >= 90) {
      this.log(`\n${colors.green}🎉 OBSERVABILITY EXTRACTION SUCCESSFUL!${colors.reset}`);
      this.log(`${colors.green}All observability components are properly implemented and integrated.${colors.reset}`);
    } else if (successRate >= 70) {
      this.log(`\n${colors.yellow}⚠️  OBSERVABILITY EXTRACTION PARTIALLY COMPLETE${colors.reset}`);
      this.log(`${colors.yellow}Most components are working, but some issues need attention.${colors.reset}`);
    } else {
      this.log(`\n${colors.red}❌ OBSERVABILITY EXTRACTION NEEDS WORK${colors.reset}`);
      this.log(`${colors.red}Significant issues found that need to be resolved.${colors.reset}`);
    }
    
    return successRate >= 70;
  }

  run() {
    this.log(`${colors.magenta}🔍 POLLARBASE OBSERVABILITY SECTION VALIDATION${colors.reset}`);
    this.log(`${colors.cyan}Starting comprehensive validation of observability extraction...${colors.reset}\n`);
    
    // Run all validation tests
    this.validateSectionContent('packages/frontend/public/content/documentation/sections/observability.json');
    this.validateCodeExamples('packages/frontend/public/content/documentation/code-examples/observability.json');
    this.validateReactComponents();
    this.validateTypeScriptIntegration();
    this.validateContentRenderer();
    this.validateOverallStructure();
    
    // Generate final report
    return this.generateReport();
  }
}

// Run the validator
const validator = new ObservabilityExtractionValidator();
const success = validator.run();

process.exit(success ? 0 : 1); 