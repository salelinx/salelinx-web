'use client';

import type { ReactNode } from 'react';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { trackInstallClick } from '@/lib/tracking';

const SEGMENT = 'M45.33 13A24 24 0 0 0 3.81 11.03L14.47 29.5L24 13Z';

function ChromeLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d={SEGMENT} fill="#EA4335" />
      <path d={SEGMENT} fill="#34A853" transform="rotate(-120 24 24)" />
      <path d={SEGMENT} fill="#FBBC04" transform="rotate(120 24 24)" />
      <circle cx="24" cy="24" r="11" fill="#fff" />
      <circle cx="24" cy="24" r="8.8" fill="#1A73E8" />
    </svg>
  );
}

// Client Component only for the click tracking: the outbound Chrome Web
// Store click is our closest measurable proxy for an install (the listing
// itself cannot be tagged). Tracking is a no-op without ads/analytics
// consent; target="_blank" keeps the navigation from racing the event.
export function InstallExtensionButton({
  label,
  className,
  showIcon = true,
}: {
  label: ReactNode;
  className: string;
  showIcon?: boolean;
}) {
  return (
    <a
      href={CHROME_WEB_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackInstallClick}
      className={className}
    >
      {showIcon ? <ChromeLogo /> : null}
      {label}
    </a>
  );
}
