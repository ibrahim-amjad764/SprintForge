import Link from 'next/link';
import { ShieldX, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="animate-enter mesh-gradient flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
        <ShieldX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-6 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
        Access denied
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Unauthorized</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        You do not have permission to access this page. If you believe this is a
        mistake, contact your workspace administrator.
      </p>
      <Link
        href="/dashboard"
        className="btn-sheen mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-150"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Dashboard
      </Link>
    </div>
  );
}
