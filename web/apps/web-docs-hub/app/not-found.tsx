import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white px-6 py-20 text-stone-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-stone-500">
          Not Found
        </p>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-950">
            That documentation page does not exist.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-stone-600">
            The page may have moved, or the URL may be incomplete. Start from the
            documentation home and navigate from there.
          </p>
        </div>
        <div>
          <Link
            href="/docs"
            className="inline-flex items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:border-stone-950"
          >
            Go to Docs
          </Link>
        </div>
      </div>
    </main>
  );
}
