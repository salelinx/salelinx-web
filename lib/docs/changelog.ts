import type { ChangelogEntryMetadata, ChangelogModule } from './types';

import * as initialRelease from '@/content/changelog/2026-04-15-initial-release.mdx';

const CHANGELOG_MODULES: ChangelogModule[] = [
  initialRelease as unknown as ChangelogModule,
];

export function listChangelog(): ChangelogModule[] {
  return [...CHANGELOG_MODULES].sort((a, b) =>
    b.metadata.date.localeCompare(a.metadata.date),
  );
}

export function getRecentChangelog(limit = 3): ChangelogEntryMetadata[] {
  return listChangelog()
    .slice(0, limit)
    .map((m) => m.metadata);
}

export function formatChangelogDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
