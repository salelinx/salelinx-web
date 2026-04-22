import type { ReactNode } from 'react';

export const metadata = {
  title: 'Docs - SaleLinx',
  description:
    'Guides, walkthroughs and troubleshooting for the SaleLinx Chrome extension.',
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="flex-1">{children}</div>;
}
