'use client';

export function Footer() {
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';

  return (
    <footer className="fixed bottom-0 left-0 md:left-64 right-0 z-40 h-8 bg-card md:pl-2 md:pr-2">
      <div className="h-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-end">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a
              href={`${landingUrl}/terms`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
            <a
              href={`${landingUrl}/privacy`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href={`${landingUrl}/cookies`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Cookie Policy
            </a>
            <span className="text-muted-foreground/70">
              © 2025 Igris Inertial
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
