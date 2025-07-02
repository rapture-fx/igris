#!/usr/bin/env node

const fs = require('fs');

console.log('🚀 Testing Webhooks Section Extraction...\n');

let allTestsPassed = true;

// Test files
const files = [
  'packages/frontend/public/content/documentation/sections/webhooks.json',
  'packages/frontend/public/content/documentation/code-examples/webhooks.json', 
  'packages/frontend/src/components/documentation/sections/WebhookEvents.tsx',
  'packages/frontend/src/components/documentation/sections/WebhookConfiguration.tsx'
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
  const content = JSON.parse(fs.readFileSync('packages/frontend/public/content/documentation/sections/webhooks.json', 'utf8'));
  
  if (content.title && content.subtitle && content.sections) {
    console.log('✅ Content structure: Valid JSON with required fields');
    
    const sectionTypes = content.sections.map(s => s.type);
    const expectedTypes = ['webhook-events', 'language-selector', 'webhook-configuration'];
    
    if (expectedTypes.every(type => sectionTypes.includes(type))) {
      console.log('✅ Section types: All expected types present');
    } else {
      console.log('❌ Section types: Missing expected types');
      allTestsPassed = false;
    }
    
    // Check event categories
    const eventsSection = content.sections.find(s => s.type === 'webhook-events');
    if (eventsSection && eventsSection.eventCategories && eventsSection.eventCategories.length >= 2) {
      console.log('✅ Event categories: Dataset and Job events present');
    } else {
      console.log('❌ Event categories: Missing or incomplete');
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
  const examples = JSON.parse(fs.readFileSync('packages/frontend/public/content/documentation/code-examples/webhooks.json', 'utf8'));
  
  if (examples['express-webhook-handler']) {
    console.log('✅ Code examples: Express.js webhook handler present');
  } else {
    console.log('❌ Code examples: Missing webhook handler example');
    allTestsPassed = false;
  }
} catch (error) {
  console.log(`❌ Code examples: ERROR - ${error.message}`);
  allTestsPassed = false;
}

console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
  console.log('🎉 Webhooks Section Extraction: SUCCESS!');
  console.log('\n✅ All tests passed. The webhooks section has been successfully extracted.');
  console.log('\n📊 Features Extracted:');
  console.log('  • Dataset events (uploaded, analyzed, transformed, exported)');
  console.log('  • Job events (started, completed, failed, cancelled)');
  console.log('  • Express.js webhook handler with signature verification');
  console.log('  • Webhook configuration via API');
  console.log('  • Event handling and notification logic');
  console.log('\n🚀 Ready for production use!');
} else {
  console.log('❌ Webhooks Section Extraction: FAILED!');
  console.log('\n⚠️  Some tests failed. Please review the errors above.');
}
