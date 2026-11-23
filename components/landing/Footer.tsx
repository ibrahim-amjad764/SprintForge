import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SprintForge. All rights reserved.
          </p>
        </div>
        <div className="flex gap-6">
          <Link
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <Link
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
