// components/auth/RegisterForm.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from './auth-styles';

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Background validation checks
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Form body excludes confirmPassword before API call
      const { name, email, password } = form;
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      router.push('/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full font-sans animate-scale-in">
      <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight">SprintForge</span>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Start your first sprint in minutes.{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in instead
        </Link>
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={authLabelClass}>
            Full name
          </label>
          <input
            id="name"
            name="name"
            placeholder="Ada Lovelace"
            value={form.name}
            onChange={handleChange}
            className={authInputClass}
            autoComplete="name"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            placeholder="you@company.com"
            type="email"
            value={form.email}
            onChange={handleChange}
            className={authInputClass}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              placeholder="At least 6 characters"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              className={`${authInputClass} pr-11`}
              autoComplete="new-password"
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

        <div>
          <label htmlFor="confirmPassword" className={authLabelClass}>
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Repeat your password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={handleChange}
              className={`${authInputClass} pr-11`}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
