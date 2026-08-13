import type { ReactNode } from 'react';

// No metadata export here on purpose: every docs page sets its own via
// pageMetadata(), and a plain-string title on a layout would break the root
// layout's `%s | SaleLinx` template chain for every page beneath it.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="flex-1">{children}</div>;
}
