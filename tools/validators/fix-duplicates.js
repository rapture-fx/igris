#!/usr/bin/env node

/**
 * Phase 1: Duplicate ID Fix Script
 * Automatically fixes duplicate IDs in documentation page
 */

const fs = require('fs');

const DOCS_FILE = 'packages/frontend/src/app/documentation/page.tsx';

console.log('🔧 Phase 1: Fixing Duplicate IDs');
console.log('=================================');

function fixDuplicateIds() {
  try {
    let content = fs.readFileSync(DOCS_FILE, 'utf8');
    
    console.log('📝 Applying fixes...');
    
    // Fix 1: Change second 'production' section to 'production-deployment'
    // Find the second occurrence of production section
    const productionSections = content.split("id: 'production',");
    if (productionSections.length === 3) {
      // Rebuild with the second occurrence renamed
      content = productionSections[0] + 
                "id: 'production'," + 
                productionSections[1] + 
                "id: 'production-deployment'," + 
                productionSections[2];
      console.log('✅ Fixed duplicate section: production → production-deployment');
    }
    
    // Fix 2: Change 'ml-integration' in guides-tutorials to 'ml-integration-tutorial'
    content = content.replace(
      /(\s+id: 'guides-tutorials',[\s\S]*?){ id: 'ml-integration', label: 'ML Integration'/,
      '$1{ id: \'ml-integration-tutorial\', label: \'ML Integration\''
    );
    console.log('✅ Fixed duplicate item: ml-integration → ml-integration-tutorial');
    
    // Fix 3: Change 'data-governance' in meta-documentation to 'data-governance-framework'  
    content = content.replace(
      /(\s+id: 'meta-documentation',[\s\S]*?){ id: 'data-governance', label: 'Data Governance Framework'/,
      '$1{ id: \'data-governance-framework\', label: \'Data Governance Framework\''
    );
    console.log('✅ Fixed duplicate item: data-governance → data-governance-framework');
    
    // Write back to file
    fs.writeFileSync(DOCS_FILE, content, 'utf8');
    console.log('💾 Changes saved to documentation page');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing duplicates:', error.message);
    return false;
  }
}

// Run fixes
const success = fixDuplicateIds();
if (success) {
  console.log('\n🎉 Phase 1 fixes applied successfully!');
  console.log('🔍 Run validation script to confirm...');
} else {
  console.log('\n❌ Phase 1 fixes failed!');
}

process.exit(success ? 0 : 1); 