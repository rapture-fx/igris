// Igris Runtime npm package
// The binary is installed via postinstall hook and accessible via bin

module.exports = {
  version: require('./package.json').version,
  binaryPath: require('path').join(__dirname, 'bin', 'igris-runtime')
};
