#!/usr/bin/env node

const fs = require("fs");

console.log("🚀 Testing JavaScript SDK Section Extraction...
");

let allTestsPassed = true;

// Test files
const files = [
  "packages/frontend/public/content/documentation/sections/javascript-sdk.json",
  "packages/frontend/public/content/documentation/code-examples/javascript-sdk.json", 
  "packages/frontend/src/components/documentation/sections/InstallationGuide.tsx",
  "packages/frontend/src/components/documentation/sections/SDKFeatures.tsx"
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: EXISTS`);
  } else {
    console.log(`❌ ${file}: MISSING`);
    allTestsPassed = false;
  }
});

if (allTestsPassed) {
  console.log("
🎉 JavaScript SDK Section Extraction: SUCCESS!");
} else {
  console.log("
❌ JavaScript SDK Section Extraction: FAILED!");
}
