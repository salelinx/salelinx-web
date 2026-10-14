import type { ReactNode } from 'react';

// Docs and blog MDX have no remark-gfm, so pipe tables render as raw text.
// Posts pass the table as props instead:
//
//   <CompareTable
//     caption="Depop and Vinted fees at a glance"
//     columns={['', 'Depop', 'Vinted']}
//     rows={[['Selling fee', 'None', 'None'], ...]}
//   />
//
// The first cell of each row is its header. Keep cells to plain facts a
// reader could check at the source; the `note` is the place to say where
// the figures come from and when they were last checked.
export function CompareTable({
  caption,
  columns,
  rows,
  note,
}: {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
  note?: ReactNode;
}) {
  return (
    <figure className="my-8">
      {/* The wrapper scrolls, not the page: a three-column table is wider
          than a phone screen. */}
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full min-w-[34rem] border-collapse text-start text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-black/[0.03] dark:bg-white/[0.04]">
              {columns.map((col, i) => (
                <th
                  key={`${col}-${i}`}
                  scope="col"
                  className="px-4 py-3 text-start font-mono text-[0.68rem] font-normal uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...cells], r) => (
              <tr key={r} className="border-t border-black/10 align-top dark:border-white/10">
                <th
                  scope="row"
                  className="px-4 py-3 text-start font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {label}
                </th>
                {cells.map((cell, c) => (
                  <td key={c} className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? (
        <figcaption className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {note}
        </figcaption>
      ) : null}
    </figure>
  );
}
