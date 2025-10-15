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

class CostOptimizationValidator {
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
    this.log(`\n${colors.cyan}🔍 Validating Cost Optimization Section Content...${colors.reset}`);
    
    this.validateFileExists(sectionPath, 'Cost optimization section JSON');
    
    if (fs.existsSync(sectionPath)) {
      const content = JSON.parse(fs.readFileSync(sectionPath, 'utf8'));
      
      // Validate main structure
      this.validateJSONStructure(sectionPath, ['sections'], 'Section structure');
      
      if (content.sections) {
        // Test cost strategies section
        this.test('Has cost-strategies section', () => {
          return content.sections.some(section => section.type === 'cost-strategies');
        });
        
        // Test cost monitoring section
        this.test('Has cost-monitoring section', () => {
          return content.sections.some(section => section.type === 'cost-monitoring');
        });
        
        // Test cost optimization techniques section
        this.test('Has cost-optimization-techniques section', () => {
          return content.sections.some(section => section.type === 'cost-optimization-techniques');
        });
        
        // Validate cost strategies data
        const strategiesSection = content.sections.find(s => s.type === 'cost-strategies');
        if (strategiesSection) {
          this.test('Cost strategies have required properties', () => {
            return strategiesSection.costStrategies && 
                   strategiesSection.costStrategies.every(strategy => 
                     strategy.name && strategy.description && strategy.color && 
                     strategy.icon && strategy.costMultiplier && strategy.timeReduction &&
                     strategy.features && strategy.useCase
                   );
          });
          
          this.test('Has 3 processing strategies (Fast, Standard, Economical)', () => {
            return strategiesSection.costStrategies && 
                   strategiesSection.costStrategies.length === 3;
          });
          
          this.test('Strategies have cost multipliers', () => {
            if (!strategiesSection.costStrategies) return false;
            const multipliers = strategiesSection.costStrategies.map(s => s.costMultiplier);
            return multipliers.includes('1.5x') && multipliers.includes('1.0x') && multipliers.includes('0.6x');
          });
        }
        
        // Validate cost monitoring data
        const monitoringSection = content.sections.find(s => s.type === 'cost-monitoring');
        if (monitoringSection) {
          this.test('Cost monitoring has required properties', () => {
            return monitoringSection.costMonitoring && 
                   monitoringSection.costMonitoring.every(monitor => 
                     monitor.category && monitor.color && monitor.icon && monitor.features
                   );
          });
          
          this.test('Has comprehensive monitoring categories', () => {
            if (!monitoringSection.costMonitoring) return false;
            const categories = monitoringSection.costMonitoring.map(m => m.category.toLowerCase());
            return categories.some(cat => cat.includes('analytics')) &&
                   categories.some(cat => cat.includes('budget')) &&
                   categories.some(cat => cat.includes('optimization'));
          });
        }
        
        // Validate optimization techniques data
        const techniquesSection = content.sections.find(s => s.type === 'cost-optimization-techniques');
        if (techniquesSection) {
          this.test('Optimization techniques have required properties', () => {
            return techniquesSection.costOptimizationTechniques && 
                   techniquesSection.costOptimizationTechniques.every(technique => 
                     technique.technique && technique.description && technique.savingsRange &&
                     technique.complexity && technique.implementation && technique.benefits
                   );
          });
          
          this.test('Has diverse optimization techniques', () => {
            if (!techniquesSection.costOptimizationTechniques) return false;
            const techniques = techniquesSection.costOptimizationTechniques.map(t => t.technique.toLowerCase());
            return techniques.some(tech => tech.includes('batch')) &&
                   techniques.some(tech => tech.includes('adaptive')) &&
                   techniques.some(tech => tech.includes('resource'));
          });
          
          this.test('Techniques have realistic savings ranges', () => {
            if (!techniquesSection.costOptimizationTechniques) return false;
            return techniquesSection.costOptimizationTechniques.every(tech => 
              tech.savingsRange.includes('%') && tech.savingsRange.includes('-')
            );
          });
        }
      }
    }
  }

  validateCodeExamples(codeExamplesPath) {
    this.log(`\n${colors.cyan}📝 Validating Cost Optimization Code Examples...${colors.reset}`);
    
    this.validateFileExists(codeExamplesPath, 'Cost optimization code examples JSON');
    
    if (fs.existsSync(codeExamplesPath)) {
      const content = JSON.parse(fs.readFileSync(codeExamplesPath, 'utf8'));
      
      this.validateJSONStructure(codeExamplesPath, ['examples'], 'Code examples structure');
      
      if (content.examples) {
        this.test('Has cost analysis example', () => {
          return content.examples.some(ex => 
            ex.id.includes('cost-analysis') || 
            ex.title.toLowerCase().includes('cost analysis')
          );
        });
        
        this.test('Has budget monitoring example', () => {
          return content.examples.some(ex => 
            ex.id.includes('budget-monitoring') || 
            ex.title.toLowerCase().includes('budget monitoring')
          );
        });
        
        this.test('Has advanced optimization example', () => {
          return content.examples.some(ex => 
            ex.id.includes('advanced-optimization') || 
            ex.title.toLowerCase().includes('advanced')
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
        this.test('Includes Python cost optimization', () => {
          return content.examples.some(ex => 
            ex.language === 'python' && ex.code.includes('CostOptimizer')
          );
        });
        
        this.test('Includes JavaScript advanced optimization', () => {
          return content.examples.some(ex => 
            ex.language === 'javascript' && ex.code.length > 2000
          );
        });
        
        this.test('Examples show cost savings calculations', () => {
          return content.examples.some(ex => 
            ex.code.includes('savings') || ex.response.includes('savings')
          );
        });
      }
    }
  }

  validateReactComponents() {
    this.log(`\n${colors.cyan}⚛️  Validating React Components...${colors.reset}`);
    
    const componentPaths = [
      'packages/frontend/src/components/documentation/sections/CostStrategies.tsx',
      'packages/frontend/src/components/documentation/sections/CostMonitoring.tsx',
      'packages/frontend/src/components/documentation/sections/CostOptimizationTechniques.tsx'
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
        
        this.test(`${path.basename(componentPath)} has cost-specific styling`, () => {
          return content.includes('cost') || content.includes('savings') || content.includes('budget');
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
      
      this.test('Has costStrategies type definition', () => {
        return content.includes('costStrategies?:');
      });
      
      this.test('Has costMonitoring type definition', () => {
        return content.includes('costMonitoring?:');
      });
      
      this.test('Has costOptimizationTechniques type definition', () => {
        return content.includes('costOptimizationTechniques?:');
      });
      
      this.test('Cost types have proper structure', () => {
        return content.includes('costMultiplier: string') && 
               content.includes('savingsRange: string') &&
               content.includes('complexity: string');
      });
    }
    
    // Check index.ts exports
    const indexPath = 'packages/frontend/src/components/documentation/sections/index.ts';
    this.validateFileExists(indexPath, 'Component index file');
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      
      this.test('Index exports CostStrategies', () => {
        return content.includes('CostStrategies');
      });
      
      this.test('Index exports CostMonitoring', () => {
        return content.includes('CostMonitoring');
      });
      
      this.test('Index exports CostOptimizationTechniques', () => {
        return content.includes('CostOptimizationTechniques');
      });
    }
  }

  validateContentRenderer() {
    this.log(`\n${colors.cyan}🎨 Validating ContentRenderer Integration...${colors.reset}`);
    
    const rendererPath = 'packages/frontend/src/components/documentation/ContentRenderer.tsx';
    this.validateFileExists(rendererPath, 'ContentRenderer component');
    
    if (fs.existsSync(rendererPath)) {
      const content = fs.readFileSync(rendererPath, 'utf8');
      
      this.test('ContentRenderer imports cost optimization components', () => {
        return content.includes('CostStrategies') && 
               content.includes('CostMonitoring') && 
               content.includes('CostOptimizationTechniques');
      });
      
      this.test('Has cost-strategies case', () => {
        return content.includes("case 'cost-strategies':");
      });
      
      this.test('Has cost-monitoring case', () => {
        return content.includes("case 'cost-monitoring':");
      });
      
      this.test('Has cost-optimization-techniques case', () => {
        return content.includes("case 'cost-optimization-techniques':");
      });
    }
  }

  validateOverallStructure() {
    this.log(`\n${colors.cyan}🏗️  Validating Overall Structure...${colors.reset}`);
    
    const requiredFiles = [
      'packages/frontend/public/content/documentation/sections/cost-optimization.json',
      'packages/frontend/public/content/documentation/code-examples/cost-optimization.json',
      'packages/frontend/src/components/documentation/sections/CostStrategies.tsx',
      'packages/frontend/src/components/documentation/sections/CostMonitoring.tsx',
      'packages/frontend/src/components/documentation/sections/CostOptimizationTechniques.tsx'
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
        return content.length > 200; // Reasonable content check
      });
    });
    
    this.test('Section focuses on cost optimization', () => {
      const sectionPath = 'packages/frontend/public/content/documentation/sections/cost-optimization.json';
      if (!fs.existsSync(sectionPath)) return false;
      
      const content = fs.readFileSync(sectionPath, 'utf8');
      return content.includes('cost') && content.includes('optimization') && content.includes('savings');
    });
  }

  generateReport() {
    this.log(`\n${colors.magenta}📊 COST OPTIMIZATION EXTRACTION VALIDATION REPORT${colors.reset}`);
    this.log(`${'='.repeat(65)}`);
    
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
    
    this.log(`\n${colors.cyan}💰 Cost Optimization Focus Areas:${colors.reset}`);
    this.log(`   • Processing strategy selection and comparison`);
    this.log(`   • Real-time cost monitoring and budget management`);
    this.log(`   • Advanced optimization techniques and implementation`);
    this.log(`   • ROI tracking and savings calculation`);
    
    if (successRate >= 90) {
      this.log(`\n${colors.green}🎉 COST OPTIMIZATION EXTRACTION SUCCESSFUL!${colors.reset}`);
      this.log(`${colors.green}All cost optimization components are properly implemented and integrated.${colors.reset}`);
    } else if (successRate >= 70) {
      this.log(`\n${colors.yellow}⚠️  COST OPTIMIZATION EXTRACTION PARTIALLY COMPLETE${colors.reset}`);
      this.log(`${colors.yellow}Most components are working, but some issues need attention.${colors.reset}`);
    } else {
      this.log(`\n${colors.red}❌ COST OPTIMIZATION EXTRACTION NEEDS WORK${colors.reset}`);
      this.log(`${colors.red}Significant issues found that need to be resolved.${colors.reset}`);
    }
    
    return successRate >= 70;
  }

  run() {
    this.log(`${colors.magenta}💰 SCHLEP-ENGINE COST OPTIMIZATION SECTION VALIDATION${colors.reset}`);
    this.log(`${colors.cyan}Starting comprehensive validation of cost optimization extraction...${colors.reset}\n`);
    
    // Run all validation tests
    this.validateSectionContent('packages/frontend/public/content/documentation/sections/cost-optimization.json');
    this.validateCodeExamples('packages/frontend/public/content/documentation/code-examples/cost-optimization.json');
    this.validateReactComponents();
    this.validateTypeScriptIntegration();
    this.validateContentRenderer();
    this.validateOverallStructure();
    
    // Generate final report
    return this.generateReport();
  }
}

// Run the validator
const validator = new CostOptimizationValidator();
const success = validator.run();

process.exit(success ? 0 : 1); 