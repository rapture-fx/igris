#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Error Handling Section Extraction...\n');

const tests = [];
let passedTests = 0;

function test(description, assertion) {
  tests.push({ description, assertion });
  try {
    const result = assertion();
    if (result) {
      console.log(`✅ ${description}`);
      passedTests++;
    } else {
      console.log(`❌ ${description} - Assertion failed`);
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
  }
}

// Test 1: Error handling section JSON exists and is valid
test('Error handling section JSON file exists', () => {
  const filePath = 'packages/frontend/public/content/documentation/sections/error-handling.json';
  return fs.existsSync(filePath);
});

test('Error handling section JSON is valid', () => {
  const filePath = 'packages/frontend/public/content/documentation/sections/error-handling.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return data.title && data.subtitle && data.sections && data.sections.length === 3;
});

test('Error categories section has correct structure', () => {
  const filePath = 'packages/frontend/public/content/documentation/sections/error-handling.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const errorCategoriesSection = data.sections.find(s => s.type === 'error-categories');
  return errorCategoriesSection && 
         errorCategoriesSection.errorCategories && 
         errorCategoriesSection.errorCategories.length === 4;
});

test('Recovery strategies section has correct structure', () => {
  const filePath = 'packages/frontend/public/content/documentation/sections/error-handling.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const recoverySection = data.sections.find(s => s.type === 'recovery-strategies');
  return recoverySection && 
         recoverySection.recoveryStrategies && 
         recoverySection.recoveryStrategies.length === 4;
});

test('Error monitoring section has correct structure', () => {
  const filePath = 'packages/frontend/public/content/documentation/sections/error-handling.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const monitoringSection = data.sections.find(s => s.type === 'error-monitoring');
  return monitoringSection && 
         monitoringSection.errorMonitoring && 
         monitoringSection.errorMonitoring.length === 3;
});

// Test 2: Code examples JSON exists and is valid
test('Error handling code examples JSON file exists', () => {
  const filePath = 'packages/frontend/public/content/documentation/code-examples/error-handling.json';
  return fs.existsSync(filePath);
});

test('Error handling code examples JSON is valid', () => {
  const filePath = 'packages/frontend/public/content/documentation/code-examples/error-handling.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return data.examples && data.examples.length === 3;
});

test('All code examples have required fields', () => {
  const filePath = 'packages/frontend/public/content/documentation/code-examples/error-handling.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return data.examples.every(example => 
    example.id && example.title && example.description && 
    example.language && example.code
  );
});

// Test 3: React components exist
test('ErrorCategories component file exists', () => {
  const filePath = 'packages/frontend/src/components/documentation/sections/ErrorCategories.tsx';
  return fs.existsSync(filePath);
});

test('RecoveryStrategies component file exists', () => {
  const filePath = 'packages/frontend/src/components/documentation/sections/RecoveryStrategies.tsx';
  return fs.existsSync(filePath);
});

test('ErrorMonitoring component file exists', () => {
  const filePath = 'packages/frontend/src/components/documentation/sections/ErrorMonitoring.tsx';
  return fs.existsSync(filePath);
});

test('All components have default exports', () => {
  const componentPaths = [
    'packages/frontend/src/components/documentation/sections/ErrorCategories.tsx',
    'packages/frontend/src/components/documentation/sections/RecoveryStrategies.tsx',
    'packages/frontend/src/components/documentation/sections/ErrorMonitoring.tsx'
  ];
  
  return componentPaths.every(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes('export default');
  });
});

// Test 4: Components are properly imported and exported
test('Components are exported in index.ts', () => {
  const filePath = 'packages/frontend/src/components/documentation/sections/index.ts';
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('ErrorCategories') && 
         content.includes('RecoveryStrategies') && 
         content.includes('ErrorMonitoring');
});

// Test 5: TypeScript types include error handling properties
test('TypeScript types include error handling properties', () => {
  const filePath = 'packages/frontend/src/types/documentation.ts';
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('errorCategories?:') && 
         content.includes('recoveryStrategies?:') && 
         content.includes('errorMonitoring?:');
});

// Test 6: ContentRenderer includes error handling cases
test('ContentRenderer includes error handling imports', () => {
  const filePath = 'packages/frontend/src/components/documentation/ContentRenderer.tsx';
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('ErrorCategories') && 
         content.includes('RecoveryStrategies') && 
         content.includes('ErrorMonitoring');
});

test('ContentRenderer includes error handling cases', () => {
  const filePath = 'packages/frontend/src/components/documentation/ContentRenderer.tsx';
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes("case 'error-categories':") && 
         content.includes("case 'recovery-strategies':") && 
         content.includes("case 'error-monitoring':");
});

// Run all tests
console.log('\n📋 Test Results:');
console.log('================');

const totalTests = tests.length;
const failedTests = totalTests - passedTests;

console.log(`\n📊 Summary:`);
console.log(`✅ Passed: ${passedTests}/${totalTests}`);
console.log(`❌ Failed: ${failedTests}/${totalTests}`);
console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 All tests passed! Error handling section extraction completed successfully.');
} else {
  console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the implementation.`);
  process.exit(1);
} 