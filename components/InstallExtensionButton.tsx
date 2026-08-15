import type { ReactNode } from 'react';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { Icon } from '@/components/Icon';

export function InstallExtensionButton({
  label,
  className,
}: {
  label: ReactNode;
  className: string;
}) {
  return (
    <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className={className}>
      <Icon name="puzzle" className="h-4 w-4" />
      {label}
    </a>
  );
}
