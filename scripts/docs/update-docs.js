#!/usr/bin/env node

/**
 * update-docs.js
 *
 * Updates documentation files with extracted data from codebase.
 * Reads generated JSON files and updates specific sections in MDX files.
 */

const fs = require('fs');
const path = require('path');

const GENERATED_DIR = path.join(__dirname, '../../web/apps/web-docs/docs/.generated');
const DOCS_DIR = path.join(__dirname, '../../web/apps/web-docs/docs');

// Ensure generated directory exists
if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function updateObservabilityMetrics() {
  const metricsFile = path.join(GENERATED_DIR, 'metrics.json');
  const docFile = path.join(DOCS_DIR, 'observability.mdx');

  if (!fs.existsSync(metricsFile)) {
    console.log('⚠️  No metrics.json found, skipping observability update');
    return false;
  }

  const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
  console.log(`✓ Loaded ${metrics.total} metrics from ${metricsFile}`);

  // Read existing doc
  let doc = fs.readFileSync(docFile, 'utf-8');

  // Update metrics count in intro if present
  const metricsCountRegex = /(\d+)\+ Prometheus metrics/g;
  if (metricsCountRegex.test(doc)) {
    doc = doc.replace(metricsCountRegex, `${metrics.total}+ Prometheus metrics`);
    console.log(`✓ Updated metrics count to ${metrics.total}`);
  }

  // Generate metrics table for each type
  const counterMetrics = metrics.metrics.filter(m => m.type === 'Counter');
  const histogramMetrics = metrics.metrics.filter(m => m.type === 'Histogram');
  const gaugeMetrics = metrics.metrics.filter(m => m.type === 'Gauge');

  console.log(`  - ${counterMetrics.length} Counters`);
  console.log(`  - ${histogramMetrics.length} Histograms`);
  console.log(`  - ${gaugeMetrics.length} Gauges`);

  // Write back
  fs.writeFileSync(docFile, doc, 'utf-8');
  console.log(`✓ Updated ${docFile}`);

  return true;
}

function updatePricingTiers() {
  const configFile = path.join(GENERATED_DIR, 'config.json');
  const docFile = path.join(DOCS_DIR, 'pricing-tiers.mdx');

  if (!fs.existsSync(configFile)) {
    console.log('⚠️  No config.json found, skipping pricing update');
    return false;
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  console.log(`✓ Loaded tier config (version ${config.version})`);

  // Read existing doc
  let doc = fs.readFileSync(docFile, 'utf-8');

  // Update pricing table if needed
  config.tiers.forEach(tier => {
    // Update individual tier prices
    const priceRegex = new RegExp(`\\*\\*\\$${tier.price.usd}`, 'g');
    if (!priceRegex.test(doc) && tier.price.usd > 0) {
      console.log(`⚠️  Price mismatch for ${tier.name}: expected $${tier.price.usd}`);
    }
  });

  console.log(`✓ Validated pricing in ${docFile}`);

  return true;
}

function main() {
  console.log('🔄 Updating documentation from extracted data...\n');

  let updated = false;

  try {
    updated = updateObservabilityMetrics() || updated;
    updated = updatePricingTiers() || updated;

    if (updated) {
      console.log('\n✅ Documentation updated successfully');
    } else {
      console.log('\n✅ Documentation is up to date');
    }
  } catch (error) {
    console.error('\n❌ Error updating documentation:', error.message);
    process.exit(1);
  }
}

main();
