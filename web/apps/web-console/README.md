# Igris Operator Console

This app is the operator console for Igris Inertial.

It is where teams inspect execution runs, follow execution events, review signed records, monitor execution environments, and manage account-level settings around access, billing, and retention.

## Purpose

The console is part of the same Request -> Execute -> Verify system described in the docs:

- Request: inspect submitted runs and execution inputs
- Execute: monitor run state, events, and environment visibility
- Verify: inspect signed records, receipt status, and audit-oriented surfaces

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Radix UI
- TanStack React Query

## Development

Prerequisites:

- Node.js 18+
- pnpm

Install and run:

```bash
pnpm install
pnpm dev
```

The app serves locally on its configured development port.

## Build

```bash
pnpm build
pnpm start
```

## Environment Variables

This app expects standard public client configuration such as:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`

Do not commit real environment values.

## Copy Guidance

When updating console copy:

- frame the console as operator visibility, not a separate product
- emphasize execution runs, events, signed records, verification status, and environment visibility
- avoid selling preview-heavy features as generally available unless they are clearly labeled
