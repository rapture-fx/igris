#!/usr/bin/env node

/**
 * Phase 1 Validation Script
 * Checks for duplicate IDs in documentation page
 */

const fs = require('fs');
const path = require('path');

const DOCS_FILE = 'packages/frontend/src/app/documentation/page.tsx';

console.log('🔍 Phase 1: Validation Script');
console.log('============================');

function extractIds(content) {
  const sectionIds = [];
  const itemIds = [];
  
  // Extract section IDs
  const sectionMatches = content.match(/id: '[^']+'/g) || [];
  sectionMatches.forEach(match => {
    const id = match.replace(/id: '([^']+)'/, '$1');
    if (content.includes(`id: '${id}',\n      title:`)) {
      sectionIds.push(id);
    } else {
      itemIds.push(id);
    }
  });
  
  return { sectionIds, itemIds };
}

function findDuplicates(arr) {
  const seen = {};
  const duplicates = [];
  
  arr.forEach(item => {
    if (seen[item]) {
      duplicates.push(item);
    } else {
      seen[item] = true;
    }
  });
  
  return duplicates;
}

function validateDocumentation() {
  try {
    const content = fs.readFileSync(DOCS_FILE, 'utf8');
    const { sectionIds, itemIds } = extractIds(content);
    
    console.log(`📊 Found ${sectionIds.length} sections and ${itemIds.length} items`);
    
    const duplicateSections = findDuplicates(sectionIds);
    const duplicateItems = findDuplicates(itemIds);
    
    console.log('\n🔍 Duplicate Analysis:');
    
    if (duplicateSections.length === 0) {
      console.log('✅ No duplicate section IDs found');
    } else {
      console.log(`❌ Duplicate section IDs: ${duplicateSections.join(', ')}`);
    }
    
    if (duplicateItems.length === 0) {
      console.log('✅ No duplicate item IDs found');
    } else {
      console.log(`❌ Duplicate item IDs: ${duplicateItems.join(', ')}`);
    }
    
    const totalDuplicates = duplicateSections.length + duplicateItems.length;
    
    console.log('\n📋 Phase 1 Status:');
    if (totalDuplicates === 0) {
      console.log('🎉 PHASE 1 COMPLETE: All duplicate IDs resolved');
      console.log('✅ Ready for Phase 2: Content Extraction');
    } else {
      console.log(`⚠️  PHASE 1 INCOMPLETE: ${totalDuplicates} duplicates remaining`);
      console.log('🔧 Action Required: Fix duplicate IDs before proceeding');
    }
    
    return totalDuplicates === 0;
    
  } catch (error) {
    console.error('❌ Error reading documentation file:', error.message);
    return false;
  }
}

// Run validation
const isValid = validateDocumentation();
process.exit(isValid ? 0 : 1); 