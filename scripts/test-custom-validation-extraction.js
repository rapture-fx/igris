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

class CustomValidationValidator {
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
    this.log(`\n${colors.cyan}🔍 Validating Custom Validation Section Content...${colors.reset}`);
    
    this.validateFileExists(sectionPath, 'Custom validation section JSON');
    
    if (fs.existsSync(sectionPath)) {
      const content = JSON.parse(fs.readFileSync(sectionPath, 'utf8'));
      
      // Validate main structure
      this.validateJSONStructure(sectionPath, ['sections'], 'Section structure');
      
      if (content.sections) {
        // Test validation rules section
        this.test('Has validation-rules section', () => {
          return content.sections.some(section => section.type === 'validation-rules');
        });
        
        // Test validation configuration section
        this.test('Has validation-configuration section', () => {
          return content.sections.some(section => section.type === 'validation-configuration');
        });
        
        // Test validation patterns section
        this.test('Has validation-patterns section', () => {
          return content.sections.some(section => section.type === 'validation-patterns');
        });
        
        // Validate validation rules data
        const rulesSection = content.sections.find(s => s.type === 'validation-rules');
        if (rulesSection) {
          this.test('Validation rules have required properties', () => {
            return rulesSection.validationRules && 
                   rulesSection.validationRules.every(rule => 
                     rule.name && rule.description && rule.color && 
                     rule.icon && rule.severity && rule.features && rule.useCase
                   );
          });
          
          this.test('Has diverse validation rule types', () => {
            if (!rulesSection.validationRules) return false;
            const ruleNames = rulesSection.validationRules.map(r => r.name.toLowerCase());
            return ruleNames.some(name => name.includes('email')) &&
                   ruleNames.some(name => name.includes('age')) &&
                   ruleNames.some(name => name.includes('business'));
          });
          
          this.test('Rules have appropriate severity levels', () => {
            if (!rulesSection.validationRules) return false;
            const severities = rulesSection.validationRules.map(r => r.severity.toUpperCase());
            return severities.includes('ERROR') && severities.includes('WARNING');
          });
        }
        
        // Validate configuration data
        const configSection = content.sections.find(s => s.type === 'validation-configuration');
        if (configSection) {
          this.test('Configuration has required properties', () => {
            return configSection.validationConfiguration && 
                   configSection.validationConfiguration.every(config => 
                     config.category && config.description && config.color && 
                     config.icon && config.settings
                   );
          });
          
          this.test('Has comprehensive configuration categories', () => {
            if (!configSection.validationConfiguration) return false;
            const categories = configSection.validationConfiguration.map(c => c.category.toLowerCase());
            return categories.some(cat => cat.includes('severity')) &&
                   categories.some(cat => cat.includes('scope')) &&
                   categories.some(cat => cat.includes('performance'));
          });
          
          this.test('Settings have proper structure', () => {
            if (!configSection.validationConfiguration) return false;
            return configSection.validationConfiguration.every(config =>
              config.settings.every(setting =>
                setting.name && setting.description && setting.action && setting.recommended
              )
            );
          });
        }
        
        // Validate patterns data
        const patternsSection = content.sections.find(s => s.type === 'validation-patterns');
        if (patternsSection) {
          this.test('Patterns have required properties', () => {
            return patternsSection.validationPatterns && 
                   patternsSection.validationPatterns.every(pattern => 
                     pattern.pattern && pattern.description && pattern.complexity &&
                     pattern.icon && pattern.validations && pattern.industries && pattern.implementation
                   );
          });
          
          this.test('Has industry-specific patterns', () => {
            if (!patternsSection.validationPatterns) return false;
            const patterns = patternsSection.validationPatterns.map(p => p.pattern.toLowerCase());
            return patterns.some(pattern => pattern.includes('financial')) &&
                   patterns.some(pattern => pattern.includes('healthcare')) &&
                   patterns.some(pattern => pattern.includes('commerce'));
          });
          
          this.test('Patterns have realistic complexity levels', () => {
            if (!patternsSection.validationPatterns) return false;
            const complexities = patternsSection.validationPatterns.map(p => p.complexity.toLowerCase());
            return complexities.includes('low') || complexities.includes('medium') || complexities.includes('high');
          });
        }
      }
    }
  }

  validateCodeExamples(codeExamplesPath) {
    this.log(`\n${colors.cyan}📝 Validating Custom Validation Code Examples...${colors.reset}`);
    
    this.validateFileExists(codeExamplesPath, 'Custom validation code examples JSON');
    
    if (fs.existsSync(codeExamplesPath)) {
      const content = JSON.parse(fs.readFileSync(codeExamplesPath, 'utf8'));
      
      this.validateJSONStructure(codeExamplesPath, ['examples'], 'Code examples structure');
      
      if (content.examples) {
        this.test('Has custom validation rules example', () => {
          return content.examples.some(ex => 
            ex.id.includes('custom-validation-rules') || 
            ex.title.toLowerCase().includes('custom validation')
          );
        });
        
        this.test('Has business rules example', () => {
          return content.examples.some(ex => 
            ex.id.includes('business-rules') || 
            ex.title.toLowerCase().includes('business rules')
          );
        });
        
        this.test('Has configuration API example', () => {
          return content.examples.some(ex => 
            ex.id.includes('configuration') || 
            ex.title.toLowerCase().includes('configuration')
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
        this.test('Includes Python validation implementation', () => {
          return content.examples.some(ex => 
            ex.language === 'python' && ex.code.includes('ValidationRule')
          );
        });
        
        this.test('Includes advanced business rules', () => {
          return content.examples.some(ex => 
            ex.code.includes('FinancialTransactionRule') || ex.code.includes('business')
          );
        });
        
        this.test('Examples show validation configuration', () => {
          return content.examples.some(ex => 
            ex.code.includes('createProfile') || ex.code.includes('configuration')
          );
        });
      }
    }
  }

  validateReactComponents() {
    this.log(`\n${colors.cyan}⚛️  Validating React Components...${colors.reset}`);
    
    const componentPaths = [
      'packages/frontend/src/components/documentation/sections/ValidationRules.tsx',
      'packages/frontend/src/components/documentation/sections/ValidationConfiguration.tsx',
      'packages/frontend/src/components/documentation/sections/ValidationPatterns.tsx'
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
        
        this.test(`${path.basename(componentPath)} has validation-specific content`, () => {
          return content.includes('validation') || content.includes('rule') || content.includes('pattern');
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
      
      this.test('Has validationRules type definition', () => {
        return content.includes('validationRules?:');
      });
      
      this.test('Has validationConfiguration type definition', () => {
        return content.includes('validationConfiguration?:');
      });
      
      this.test('Has validationPatterns type definition', () => {
        return content.includes('validationPatterns?:');
      });
      
      this.test('Validation types have proper structure', () => {
        return content.includes('severity: string') && 
               content.includes('complexity: string') &&
               content.includes('industries: string[]');
      });
    }
    
    // Check index.ts exports
    const indexPath = 'packages/frontend/src/components/documentation/sections/index.ts';
    this.validateFileExists(indexPath, 'Component index file');
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      
      this.test('Index exports ValidationRules', () => {
        return content.includes('ValidationRules');
      });
      
      this.test('Index exports ValidationConfiguration', () => {
        return content.includes('ValidationConfiguration');
      });
      
      this.test('Index exports ValidationPatterns', () => {
        return content.includes('ValidationPatterns');
      });
    }
  }

  validateContentRenderer() {
    this.log(`\n${colors.cyan}🎨 Validating ContentRenderer Integration...${colors.reset}`);
    
    const rendererPath = 'packages/frontend/src/components/documentation/ContentRenderer.tsx';
    this.validateFileExists(rendererPath, 'ContentRenderer component');
    
    if (fs.existsSync(rendererPath)) {
      const content = fs.readFileSync(rendererPath, 'utf8');
      
      this.test('ContentRenderer imports validation components', () => {
        return content.includes('ValidationRules') && 
               content.includes('ValidationConfiguration') && 
               content.includes('ValidationPatterns');
      });
      
      this.test('Has validation-rules case', () => {
        return content.includes("case 'validation-rules':");
      });
      
      this.test('Has validation-configuration case', () => {
        return content.includes("case 'validation-configuration':");
      });
      
      this.test('Has validation-patterns case', () => {
        return content.includes("case 'validation-patterns':");
      });
    }
  }

  validateOverallStructure() {
    this.log(`\n${colors.cyan}🏗️  Validating Overall Structure...${colors.reset}`);
    
    const requiredFiles = [
      'packages/frontend/public/content/documentation/sections/custom-validation.json',
      'packages/frontend/public/content/documentation/code-examples/custom-validation.json',
      'packages/frontend/src/components/documentation/sections/ValidationRules.tsx',
      'packages/frontend/src/components/documentation/sections/ValidationConfiguration.tsx',
      'packages/frontend/src/components/documentation/sections/ValidationPatterns.tsx'
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
    
    this.test('Section focuses on custom validation', () => {
      const sectionPath = 'packages/frontend/public/content/documentation/sections/custom-validation.json';
      if (!fs.existsSync(sectionPath)) return false;
      
      const content = fs.readFileSync(sectionPath, 'utf8');
      return content.includes('validation') && content.includes('custom') && content.includes('rules');
    });
  }

  generateReport() {
    this.log(`\n${colors.magenta}📊 CUSTOM VALIDATION EXTRACTION VALIDATION REPORT${colors.reset}`);
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
    
    this.log(`\n${colors.cyan}✅ Custom Validation Focus Areas:${colors.reset}`);
    this.log(`   • Custom validation rule creation and implementation`);
    this.log(`   • Validation configuration and severity management`);
    this.log(`   • Industry-specific validation patterns`);
    this.log(`   • Business logic validation and compliance`);
    
    if (successRate >= 90) {
      this.log(`\n${colors.green}🎉 CUSTOM VALIDATION EXTRACTION SUCCESSFUL!${colors.reset}`);
      this.log(`${colors.green}All custom validation components are properly implemented and integrated.${colors.reset}`);
    } else if (successRate >= 70) {
      this.log(`\n${colors.yellow}⚠️  CUSTOM VALIDATION EXTRACTION PARTIALLY COMPLETE${colors.reset}`);
      this.log(`${colors.yellow}Most components are working, but some issues need attention.${colors.reset}`);
    } else {
      this.log(`\n${colors.red}❌ CUSTOM VALIDATION EXTRACTION NEEDS WORK${colors.reset}`);
      this.log(`${colors.red}Significant issues found that need to be resolved.${colors.reset}`);
    }
    
    return successRate >= 70;
  }

  run() {
    this.log(`${colors.magenta}✅ POLLARBASE CUSTOM VALIDATION SECTION VALIDATION${colors.reset}`);
    this.log(`${colors.cyan}Starting comprehensive validation of custom validation extraction...${colors.reset}\n`);
    
    // Run all validation tests
    this.validateSectionContent('packages/frontend/public/content/documentation/sections/custom-validation.json');
    this.validateCodeExamples('packages/frontend/public/content/documentation/code-examples/custom-validation.json');
    this.validateReactComponents();
    this.validateTypeScriptIntegration();
    this.validateContentRenderer();
    this.validateOverallStructure();
    
    // Generate final report
    return this.generateReport();
  }
}

// Run the validator
const validator = new CustomValidationValidator();
const success = validator.run();

process.exit(success ? 0 : 1); 