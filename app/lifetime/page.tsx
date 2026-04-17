export default function LifetimePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Lifetime Pro — £249
      </h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Pay once. Use Pro forever. Limited to the first 100 customers.
      </p>
      <button
        type="button"
        className="mt-10 rounded-full bg-black px-8 py-4 text-white dark:bg-white dark:text-black"
      >
        Buy now
      </button>
    </main>
  );
}
