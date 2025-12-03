#!/usr/bin/env node

/**
 * extract-metrics.js
 *
 * Extracts Prometheus metrics from Go source code for documentation.
 * Scans internal/observability/metrics.go and outputs structured JSON.
 */

const fs = require('fs');
const path = require('path');

const METRICS_FILE = path.join(__dirname, '../../internal/observability/metrics.go');

function extractMetrics() {
  if (!fs.existsSync(METRICS_FILE)) {
    console.error(`Error: Metrics file not found at ${METRICS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(METRICS_FILE, 'utf-8');
  const metrics = [];

  // Extract Counter metrics
  const counterRegex = /(\w+)\s*=\s*promauto\.NewCounterVec\(\s*prometheus\.CounterOpts\{[\s\S]*?Name:\s*"([^"]+)"[\s\S]*?Help:\s*"([^"]+)"[\s\S]*?\},\s*\[\]string\{([^}]+)\}/g;

  let match;
  while ((match = counterRegex.exec(content)) !== null) {
    const [, varName, name, help, labels] = match;
    metrics.push({
      type: 'Counter',
      variable: varName,
      name: name,
      help: help,
      labels: labels.split(',').map(l => l.trim().replace(/"/g, ''))
    });
  }

  // Extract Histogram metrics
  const histogramRegex = /(\w+)\s*=\s*promauto\.NewHistogramVec\(\s*prometheus\.HistogramOpts\{[\s\S]*?Name:\s*"([^"]+)"[\s\S]*?Help:\s*"([^"]+)"[\s\S]*?Buckets:\s*(\[[\s\S]*?\])[\s\S]*?\},\s*\[\]string\{([^}]+)\}/g;

  while ((match = histogramRegex.exec(content)) !== null) {
    const [, varName, name, help, buckets, labels] = match;
    metrics.push({
      type: 'Histogram',
      variable: varName,
      name: name,
      help: help,
      buckets: buckets,
      labels: labels.split(',').map(l => l.trim().replace(/"/g, ''))
    });
  }

  // Extract Gauge metrics
  const gaugeRegex = /(\w+)\s*=\s*promauto\.NewGauge(?:Vec)?\(\s*prometheus\.GaugeOpts\{[\s\S]*?Name:\s*"([^"]+)"[\s\S]*?Help:\s*"([^"]+)"[\s\S]*?\}(?:,\s*\[\]string\{([^}]+)\})?\)/g;

  while ((match = gaugeRegex.exec(content)) !== null) {
    const [, varName, name, help, labels] = match;
    metrics.push({
      type: 'Gauge',
      variable: varName,
      name: name,
      help: help,
      labels: labels ? labels.split(',').map(l => l.trim().replace(/"/g, '')) : []
    });
  }

  return {
    total: metrics.length,
    extracted_at: new Date().toISOString(),
    source_file: METRICS_FILE,
    metrics: metrics
  };
}

// Output JSON
const result = extractMetrics();
console.log(JSON.stringify(result, null, 2));
