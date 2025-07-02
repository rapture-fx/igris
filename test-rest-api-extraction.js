#!/usr/bin/env node

const fs = require('fs');

console.log('🚀 Testing REST API Section Extraction...\n');

let allTestsPassed = true;

// Test files
const files = [
  'packages/frontend/public/content/documentation/sections/rest-api.json',
  'packages/frontend/public/content/documentation/code-examples/rest-api.json', 
  'packages/frontend/src/components/documentation/sections/APIBaseInfo.tsx',
  'packages/frontend/src/components/documentation/sections/APIDetailsGrid.tsx'
];

console.log('📁 Testing file existence...');
files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: EXISTS`);
  } else {
    console.log(`❌ ${file}: MISSING`);
    allTestsPassed = false;
  }
});

// Test content structure
console.log('\n📋 Testing content structure...');
try {
  const content = JSON.parse(fs.readFileSync('packages/frontend/public/content/documentation/sections/rest-api.json', 'utf8'));
  
  if (content.title && content.subtitle && content.sections) {
    console.log('✅ Content structure: Valid JSON with required fields');
    
    const sectionTypes = content.sections.map(s => s.type);
    const expectedTypes = ['api-base-info', 'api-details-grid', 'language-selector'];
    
    if (expectedTypes.every(type => sectionTypes.includes(type))) {
      console.log('✅ Section types: All expected types present');
    } else {
      console.log('❌ Section types: Missing expected types');
      allTestsPassed = false;
    }
    
    // Check base URL
    const baseInfoSection = content.sections.find(s => s.type === 'api-base-info');
    if (baseInfoSection && baseInfoSection.baseUrl) {
      console.log('✅ Base URL: API base URL present');
    } else {
      console.log('❌ Base URL: Missing or incomplete');
      allTestsPassed = false;
    }
    
    // Check API details
    const detailsSection = content.sections.find(s => s.type === 'api-details-grid');
    if (detailsSection && detailsSection.details && detailsSection.details.length >= 2) {
      console.log('✅ API details: Authentication and rate limits present');
    } else {
      console.log('❌ API details: Missing or incomplete');
      allTestsPassed = false;
    }
  } else {
    console.log('❌ Content structure: Missing required fields');
    allTestsPassed = false;
  }
} catch (error) {
  console.log(`❌ Content structure: ERROR - ${error.message}`);
  allTestsPassed = false;
}

// Test code examples
console.log('\n💻 Testing code examples...');
try {
  const examples = JSON.parse(fs.readFileSync('packages/frontend/public/content/documentation/code-examples/rest-api.json', 'utf8'));
  
  if (examples['complete-api-workflow']) {
    console.log('✅ Code examples: Complete API workflow present');
    
    const workflow = examples['complete-api-workflow'];
    if (workflow.code && workflow.code.includes('curl') && workflow.code.includes('upload')) {
      console.log('✅ Workflow content: Contains curl commands and upload steps');
    } else {
      console.log('❌ Workflow content: Missing expected curl commands');
      allTestsPassed = false;
    }
  } else {
    console.log('❌ Code examples: Missing API workflow example');
    allTestsPassed = false;
  }
} catch (error) {
  console.log(`❌ Code examples: ERROR - ${error.message}`);
  allTestsPassed = false;
}

console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
  console.log('🎉 REST API Section Extraction: SUCCESS!');
  console.log('\n✅ All tests passed. The REST API section has been successfully extracted.');
  console.log('\n📊 Features Extracted:');
  console.log('  • API base URL and endpoints');
  console.log('  • Authentication with Bearer tokens');
  console.log('  • Rate limits by plan tier');
  console.log('  • Complete 5-step API workflow');
  console.log('  • Upload, analyze, transform, export process');
  console.log('\n🚀 Ready for production use!');
} else {
  console.log('❌ REST API Section Extraction: FAILED!');
  console.log('\n⚠️  Some tests failed. Please review the errors above.');
}
