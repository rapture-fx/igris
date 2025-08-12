# Schlep Engine API Documentation

A comprehensive, interactive API documentation site built with Next.js and Tailwind CSS.

## Features

- **Professional Design**: Clean, modern design inspired by Stripe and Postman docs
- **Interactive Examples**: Code examples for cURL, Python, and JavaScript
- **Comprehensive Coverage**: Complete API reference with detailed explanations
- **Developer-Focused**: Built for developers, by developers
- **Search Functionality**: Fast search across all documentation
- **Responsive Design**: Works perfectly on all devices

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3001](http://localhost:3001) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Documentation Structure

- **Getting Started**: Quick start guide, authentication, rate limits
- **API Reference**: Complete endpoint documentation with examples
- **Guides**: Best practices and workflow guides
- **SDKs**: Language-specific SDKs and integration examples
- **Use Cases**: Industry-specific implementation examples
- **Advanced Topics**: Webhooks, batch processing, custom transformations

## Components

### EndpointCard
Interactive API endpoint documentation with:
- Method and path display
- Parameter documentation
- Response examples
- Multi-language code examples
- Copy-to-clipboard functionality

### CodeBlock
Syntax-highlighted code blocks with:
- Language detection
- Copy functionality
- Line numbers (optional)
- Custom titles

### Sidebar
Collapsible navigation with:
- Section grouping
- Active state indication
- Responsive design

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.