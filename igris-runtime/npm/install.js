#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const VERSION = 'v1.6.0';
const BASE_URL = 'https://runtime.igrisinertial.com';

function getPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin' && arch === 'arm64') {
    return 'macos-arm64';
  } else if (platform === 'darwin' && arch === 'x64') {
    console.error('Intel Mac (x64) is not supported in this release.');
    console.error('Supported platforms: macOS Apple Silicon, Linux x64/ARM64');
    process.exit(1);
  } else if (platform === 'linux' && arch === 'x64') {
    return 'linux-x64';
  } else if (platform === 'linux' && arch === 'arm64') {
    return 'linux-arm64';
  } else {
    console.error(`Unsupported platform: ${platform} ${arch}`);
    console.error('Supported platforms: macOS Apple Silicon, Linux x64/ARM64');
    process.exit(1);
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function install() {
  try {
    const platform = getPlatform();
    const filename = `igris-runtime-${platform}.tar.gz`;
    const url = `${BASE_URL}/${VERSION}/${filename}`;
    const binDir = path.join(__dirname, 'bin');
    const tarPath = path.join(__dirname, filename);

    // Create bin directory
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Download binary
    console.log(`Installing Igris Runtime ${VERSION} for ${platform}...`);
    await download(url, tarPath);

    // Extract binary
    console.log('Extracting...');
    execSync(`tar -xzf ${tarPath} -C ${binDir}`, { stdio: 'inherit' });

    // Make executable
    const binaryPath = path.join(binDir, 'igris-runtime');
    fs.chmodSync(binaryPath, 0o755);

    // Clean up tar file
    fs.unlinkSync(tarPath);

    console.log('✓ Igris Runtime installed successfully!');
    console.log('');
    console.log('🚀 Get Started:');
    console.log('  1. Get your FREE license (1 device): https://igrisinertial.com/signup');
    console.log('  2. Set license key: export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx');
    console.log('  3. Run: npx @igris/runtime serve');
    console.log('');
    console.log('📖 Documentation: https://docs.igrisinertial.com');
    console.log('💰 Pricing: https://igrisinertial.com/pricing');
  } catch (error) {
    console.error('Installation failed:', error.message);
    process.exit(1);
  }
}

install();
