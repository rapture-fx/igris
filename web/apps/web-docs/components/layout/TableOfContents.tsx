'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Extract headings from the page
    const elements = document.querySelectorAll('h2, h3');
    const headingData: Heading[] = [];

    elements.forEach((element, index) => {
      const id = element.id || `heading-${index}`;
      if (!element.id) {
        element.id = id;
      }

      headingData.push({
        id,
        text: element.textContent || '',
        level: parseInt(element.tagName[1]),
      });
    });

    setHeadings(headingData);

    // Set up intersection observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66%' }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-6">
      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-4">
        On This Page
      </h4>
      <nav className="max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-hide">
        <ul className="space-y-2">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  'block text-sm transition-colors py-1',
                  heading.level === 3 && 'pl-4',
                  activeId === heading.id
                    ? 'text-primary font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                )}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(heading.id)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
