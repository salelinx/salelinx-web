import { isValidElement, type ReactNode } from 'react';

// Block-level tags get a space pushed after their children so two adjacent
// paragraphs don't run together as "...toolbar.Full walkthrough...". Inline
// content is joined with no separator on purpose: the surrounding strings
// already carry their own spacing (" and pin the extension"), so inserting
// one would double it.
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'br',
  'li',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'tr',
  'td',
  'th',
  'blockquote',
  'pre',
]);

/**
 * Flatten a FAQ answer's JSX to plain text for structured data.
 *
 * Walks the element tree collecting string and number children. Component
 * elements (Link, InstallExtensionButton) are descended into for their
 * children but never rendered, so this needs no request context and cannot
 * blow up on a client component. A component with no text children simply
 * contributes nothing, which is the right answer for a button.
 */
export function faqPlainText(node: ReactNode): string {
  const parts: string[] = [];

  const walk = (n: ReactNode): void => {
    if (n === null || n === undefined || typeof n === 'boolean') return;
    if (typeof n === 'string' || typeof n === 'number') {
      parts.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const child of n) walk(child);
      return;
    }
    if (isValidElement(n)) {
      const { children } = n.props as { children?: ReactNode };
      walk(children);
      if (typeof n.type === 'string' && BLOCK_TAGS.has(n.type)) parts.push(' ');
    }
  };

  walk(node);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
