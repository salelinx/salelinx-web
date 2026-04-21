import type { MDXComponents } from 'mdx/types';
import { Callout } from '@/components/docs/mdx/Callout';
import { Figure } from '@/components/docs/mdx/Figure';
import { VideoEmbed } from '@/components/docs/mdx/VideoEmbed';
import { InstallPinCallout } from '@/components/docs/mdx/InstallPinCallout';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-2 mb-6 text-4xl font-semibold tracking-tight sm:text-5xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-12 mb-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 mb-3 text-lg font-semibold tracking-tight">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-4 leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="my-4 list-disc space-y-1.5 pl-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 list-decimal space-y-1.5 pl-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        className="underline underline-offset-4 hover:text-black dark:hover:text-white"
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-lg border border-black/10 bg-black/[0.03] p-4 font-mono text-sm dark:border-white/10 dark:bg-white/[0.03]">
        {children}
      </pre>
    ),
    hr: () => (
      <hr className="my-10 border-t border-black/10 dark:border-white/10" />
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-black/20 pl-4 text-zinc-600 italic dark:border-white/20 dark:text-zinc-400">
        {children}
      </blockquote>
    ),
    Callout,
    Figure,
    VideoEmbed,
    InstallPinCallout,
    ...components,
  };
}
