import { describe, expect, it } from 'vitest';
import { createElement as h, Fragment } from 'react';
import { faqPlainText } from '../lib/faq/plain-text';
import { faqJsonLd } from '../lib/faq/jsonld';
import type { FAQGroup } from '../lib/faq/types';

function Button() {
  return null;
}

describe('faqPlainText', () => {
  it('keeps inline spacing but separates adjacent blocks', () => {
    const node = h(
      Fragment,
      null,
      h('p', null, 'Install from the ', h('a', { href: '#' }, 'Web Store'), '.'),
      h('p', null, 'Then pin it.'),
    );
    expect(faqPlainText(node)).toBe('Install from the Web Store. Then pin it.');
  });

  it('collapses whitespace and ignores components with no text', () => {
    const node = h('p', null, '  spaced\n   out  ', h(Button, null));
    expect(faqPlainText(node)).toBe('spaced out');
  });

  it('descends into components for their text children', () => {
    const node = h('p', null, 'see ', h(Button, null, 'the docs'));
    expect(faqPlainText(node)).toBe('see the docs');
  });

  it('handles list items without gluing them together', () => {
    const node = h('ul', null, h('li', null, 'one'), h('li', null, 'two'));
    expect(faqPlainText(node)).toBe('one two');
  });
});

// Built here rather than imported from lib/faq/data.en: that module pulls in
// @/i18n/navigation, which needs Next's module resolution and cannot load
// under plain vitest. The shape is what matters, not the real copy.
const GROUPS: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    blurb: 'Installing SaleLinx.',
    items: [
      {
        id: 'install',
        q: 'How do I install the extension?',
        a: h(
          Fragment,
          null,
          h('p', null, 'Install from the ', h('a', { href: '#' }, 'Web Store'), '.'),
          h('p', null, 'Then pin it to your toolbar.'),
        ),
      },
      {
        id: 'browsers',
        q: 'Which browsers are supported?',
        a: h('p', null, 'Chrome and Chromium browsers.'),
      },
      // Flattens to nothing, so it must be dropped rather than emitted.
      { id: 'button-only', q: 'Bare button?', a: h(Button, null) },
    ],
  },
];

describe('faqJsonLd', () => {
  const graph = faqJsonLd({ locale: 'en', groups: GROUPS });
  const nodes = graph['@graph'] as Record<string, unknown>[];
  const faq = nodes[0];
  const questions = faq.mainEntity as {
    name: string;
    acceptedAnswer: { text: string };
  }[];

  it('emits a FAQPage and drops answers that flatten to nothing', () => {
    expect(faq['@type']).toBe('FAQPage');
    expect(questions.map((q) => q.name)).toEqual([
      'How do I install the extension?',
      'Which browsers are supported?',
    ]);
  });

  it('gives every question a non-empty answer', () => {
    // A blank acceptedAnswer is invalid structured data, so this is the check
    // that actually matters: the JSX flattening has to produce real text for
    // every entry, not just not crash.
    for (const q of questions) {
      expect(q.name.length).toBeGreaterThan(0);
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it('does not leak JSX or object stringification into answers', () => {
    for (const q of questions) {
      expect(q.acceptedAnswer.text).not.toContain('[object Object]');
      expect(q.acceptedAnswer.text).not.toContain('<');
    }
  });
});
