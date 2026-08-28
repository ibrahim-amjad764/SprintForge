import Link from 'next/link';

export default function Hero() {
  return (
    <section className="py-20 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Build Better Software Teams
      </h1>

      <p className="text-muted-foreground mx-auto mt-5 max-w-2xl">
        The all-in-one project management tool built specifically for agile
        development teams. Track progress, ship code faster, and collaborate
        seamlessly.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/register"
          // className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Start Building
        </Link>
        {/* <Link
          href="/login"
          className="rounded-md border px-6 py-3 text-sm font-semibold hover:bg-muted"
        >
          Sign In
        </Link> */}
      </div>
    </section>
  );
}
