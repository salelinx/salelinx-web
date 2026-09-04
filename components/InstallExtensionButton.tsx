'use client';

import type { ReactNode } from 'react';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { Icon } from '@/components/Icon';
import { trackInstallClick } from '@/lib/tracking';

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
      {showIcon ? <Icon name="puzzle" className="h-4 w-4" /> : null}
      {label}
    </a>
  );
}
