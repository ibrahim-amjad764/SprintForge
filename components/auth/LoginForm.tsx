// components/auth/LoginForm.tsx

'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, X, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuthContext } from '@/context/AuthContext';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from './auth-styles';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered') === 'true';
  const { refreshUser } = useAuthContext();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Custom Toast State Configuration
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | '';
  }>(() =>
    isRegistered
      ? { message: 'Account created successfully! Please login.', type: 'success' }
      : { message: '', type: '' }
  );

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  // Automatically hide the registration success toast after 4 seconds
  useEffect(() => {
    if (!isRegistered) return;

    const timer = setTimeout(() => setToast({ message: '', type: '' }), 4000);
    return () => clearTimeout(timer);
  }, [isRegistered]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setToast({ message: '', type: '' });

      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      await refreshUser();

      // Show login success toast right before routing transition
      setToast({ message: 'Login successful! Redirecting...', type: 'success' });

      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1000);

    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Invalid email or password.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full font-sans relative animate-scale-in">

      {/* Dynamic toast layer — preserved behavior */}
      {toast.message && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 max-w-sm w-full border rounded-lg p-4 shadow-popover transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast({ message: '', type: '' })}
              aria-label="Dismiss notification"
              className="ml-3 rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight">SprintForge</span>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Sign in to continue to your workspace.{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            className={authInputClass}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              className={`${authInputClass} pr-11`}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={authPrimaryButtonClass}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div className="text-center p-12">Loading Form...</div>}>
      <LoginContent />
    </Suspense>
  );
}
