'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  words: string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  className?: string;
};

type Phase = 'typing' | 'hold' | 'deleting';

export function Typewriter({
  words,
  typeMs = 55,
  deleteMs = 28,
  holdMs = 1500,
  className,
}: Props) {
  const safeWords = useMemo(() => (words.length > 0 ? words : ['']), [words]);

  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState(safeWords[0]);
  const [phase, setPhase] = useState<Phase>('hold');

  useEffect(() => {
    const current = safeWords[wordIndex];

    if (phase === 'hold') {
      const t = setTimeout(() => setPhase('deleting'), holdMs);
      return () => clearTimeout(t);
    }

    if (phase === 'deleting') {
      if (text.length === 0) {
        const t = setTimeout(() => {
          setWordIndex((i) => (i + 1) % safeWords.length);
          setPhase('typing');
        }, 220);
        return () => clearTimeout(t);
      }
      const jitter = Math.random() * 18;
      const t = setTimeout(() => setText(text.slice(0, -1)), deleteMs + jitter);
      return () => clearTimeout(t);
    }

    if (text === current) {
      const t = setTimeout(() => setPhase('hold'), 0);
      return () => clearTimeout(t);
    }
    const nextChar = current.charAt(text.length);
    const isPunct = /[.!?,]/.test(nextChar);
    const jitter = Math.random() * 50;
    const delay = (isPunct ? typeMs * 3 : typeMs) + jitter;
    const t = setTimeout(
      () => setText(current.slice(0, text.length + 1)),
      delay,
    );
    return () => clearTimeout(t);
  }, [phase, text, wordIndex, safeWords, typeMs, deleteMs, holdMs]);

  const idle = phase === 'hold';

  return (
    <span className={className}>
      <span className="whitespace-pre font-semibold text-zinc-900 dark:text-zinc-100">
        {text}
      </span>
      <span
        aria-hidden
        className={[
          'ml-[0.08em] inline-block h-[1em] w-[0.55em] translate-y-[0.15em] rounded-[1px] bg-current align-baseline text-zinc-900 dark:text-zinc-100',
          idle ? 'tw-caret-blink' : 'opacity-100',
        ].join(' ')}
      />
      <span className="sr-only">{safeWords[wordIndex]}</span>
      <style>{`
        @keyframes tw-caret-blink-kf { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .tw-caret-blink { animation: tw-caret-blink-kf 1s steps(1, end) infinite; }
      `}</style>
    </span>
  );
}
