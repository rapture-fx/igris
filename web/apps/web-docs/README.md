# Schlep-engine Documentation

Custom Next.js documentation site with the same design as the web-console dashboard.

## Features

- **Custom Next.js app** - Full control over layout and design
- **Dashboard design** - Exact same sidebar and styling as web-console
- **MDX support** - Write documentation in Markdown with JSX components
- **Fast & lightweight** - No heavy framework overhead
- **Easy to customize** - Simple, clean codebase

## Development

```bash
# From the web directory
pnpm dev:docs

# Or from web-docs directory
pnpm dev
```

The site will run on http://localhost:3002

## Structure

```
web-docs/
├── app/
│   ├── docs/           # Documentation pages
│   └── layout.tsx      # Root layout
├── components/
│   └── layout/         # Layout components (Sidebar, etc.)
├── styles/
│   └── globals.css     # Global styles matching dashboard
└── public/
    └── img/            # Images and assets
```

## Adding New Documentation

Create new pages in `app/docs/`:

```tsx
// app/docs/your-page/page.tsx
import { DocsLayout } from '@/components/layout/DocsLayout';

export default function YourPage() {
  return (
    <DocsLayout>
      <div className="prose max-w-none">
        <h1>Your Page Title</h1>
        <p>Your content here...</p>
      </div>
    </DocsLayout>
  );
}
```

## Updating Sidebar Navigation

Edit `components/layout/DocsSidebar.tsx` to add/remove navigation items.
