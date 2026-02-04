#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const binaryPath = path.join(__dirname, 'igris-runtime');

// Forward all arguments to the binary
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => {
  process.exit(code);
});
