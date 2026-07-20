// Shared section renderer for the legal pages (privacy policy, terms).
// Legal body copy is intentionally hardcoded English and not run through
// next-intl: these are legal documents and a mistranslated clause is a
// liability. Only the page titles come from the Legal namespace.

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  trailing?: string[];
}

export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p
              key={p.slice(0, 40)}
              className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
              {p}
            </p>
          ))}
          {section.bullets && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {section.bullets.map((b) => (
                <li key={b.slice(0, 40)}>{b}</li>
              ))}
            </ul>
          )}
          {section.trailing?.map((p) => (
            <p
              key={p.slice(0, 40)}
              className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
