#!/usr/bin/env node

/**
 * extract-config.js
 *
 * Extracts tier configuration from config/tier_config.yaml for documentation.
 * Outputs structured JSON with pricing, limits, and features.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const CONFIG_FILE = path.join(__dirname, '../../config/tier_config.yaml');

function extractConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Error: Config file not found at ${CONFIG_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = yaml.parse(content);

  // Extract tier information
  const tiers = Object.entries(config.tiers).map(([tierName, tierData]) => {
    return {
      name: tierName,
      display_name: tierData.display_name,
      description: tierData.description,
      price: {
        usd: tierData.price.usd,
        billing_period: tierData.price.billing_period,
        overage_rate: tierData.price.overage_rate_per_1k || 0
      },
      limits: {
        requests_per_month: tierData.limits.max_requests_per_month,
        requests_per_second: tierData.limits.max_requests_per_second,
        requests_per_minute: tierData.limits.max_requests_per_minute,
        max_providers: tierData.limits.max_providers,
        max_tenants: tierData.limits.max_tenants,
        max_api_keys: tierData.limits.max_api_keys
      },
      features: tierData.features,
      sla: tierData.limits.sla_uptime_percent || null
    };
  });

  return {
    version: config.version,
    last_updated: config.last_updated,
    extracted_at: new Date().toISOString(),
    source_file: CONFIG_FILE,
    tiers: tiers,
    global: config.global
  };
}

// Output JSON
const result = extractConfig();
console.log(JSON.stringify(result, null, 2));
