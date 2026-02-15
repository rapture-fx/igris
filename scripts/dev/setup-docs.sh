#!/bin/bash

echo "Setting up Igris Inertial API Documentation..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

# Navigate to api-docs directory
cd api-docs

echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully!"
else
    echo "Failed to install dependencies"
    exit 1
fi

echo "Building the documentation site..."
npm run build

if [ $? -eq 0 ]; then
    echo "Documentation site built successfully!"
else
    echo "Failed to build documentation site"
    exit 1
fi

echo ""
echo "Setup complete! You can now:"
echo ""
echo "  • Start development server: cd api-docs && npm run dev"
echo "  • Start production server: cd api-docs && npm start"
echo "  • View the site at: http://localhost:3001"
echo ""
echo "Documentation includes:"
echo "  • Getting Started guide"
echo "  • Complete API Reference"
echo "  • SDK examples for Python, JavaScript, and cURL"
echo "  • Best practices and guides"
echo "  • Industry-specific use cases"
echo ""
echo "Happy documenting!"