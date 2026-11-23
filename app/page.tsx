'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import ThemeToggle from '@/components/theme/ThemeToggle';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Testimonials from '@/components/landing/Testimonials';
import Pricing from '@/components/landing/Pricing';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
              <Zap className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight">SprintForge</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="#pricing"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Pricing
            </Link>
            <ThemeToggle />
            <Link
              href="/login"
              className="btn-sheen rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:px-3.5 sm:py-2 sm:text-sm"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn-sheen rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-glow transition-all hover:brightness-110 sm:px-3.5 sm:py-2 sm:text-sm"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
      </main>

      <Footer />
    </div>
  );
}
