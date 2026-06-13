'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { scrollToLandingSection } from '../lib/landing-sections';

type LandingSectionLinkProps = {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

/** In-page section link with fixed-header-aware scroll on the home page. */
export default function LandingSectionLink({
  href,
  className,
  style,
  children,
  onClick,
}: LandingSectionLinkProps) {
  const pathname = usePathname();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!href.startsWith('/#')) return;

    const hash = href.slice(2);
    if (pathname === '/') {
      event.preventDefault();
      window.history.pushState(null, '', href);
      scrollToLandingSection(hash);
    }
  };

  return (
    <Link href={href} prefetch={false} onClick={handleClick} className={className} style={style}>
      {children}
    </Link>
  );
}