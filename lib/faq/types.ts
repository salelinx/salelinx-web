import type { ReactNode } from 'react';

export type FAQItem = {
  id: string;
  q: string;
  a: ReactNode;
  keywords?: string[];
};

export type FAQGroup = {
  slug: string;
  title: string;
  blurb: string;
  items: FAQItem[];
};
