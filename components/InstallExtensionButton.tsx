import type { ReactNode } from 'react';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { Icon } from '@/components/Icon';

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
    <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {showIcon ? <Icon name="puzzle" className="h-4 w-4" /> : null}
      {label}
    </a>
  );
}
