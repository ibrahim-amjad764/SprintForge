'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthContext';
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
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 pr-8">
          <Link href="/" className="text-xl font-bold">
            SprintForge
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Hero />
        
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold">Features</h2>
          <Features />
        </section>

        <HowItWorks />
        
        <Testimonials />
        
        <Pricing />
      </main>

      <Footer />
    </div>
  );
}
