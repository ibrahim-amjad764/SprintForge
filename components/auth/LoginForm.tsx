// components/auth/LoginForm.tsx

'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useAuthContext } from '@/context/AuthContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered') === 'true';
  const { refreshUser } = useAuthContext();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Custom Toast State Configuration
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | '' }>({
    message: '',
    type: ''
  });

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  // Automatically trigger success toast if coming from register redirect parameters
  useEffect(() => {
    if (isRegistered) {
      setToast({
        message: 'Account created successfully! Please login.',
        type: 'success'
      });
      
      // Auto-hide toast after 4 seconds
      const timer = setTimeout(() => setToast({ message: '', type: '' }), 4000);
      return () => clearTimeout(timer);
    }
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

    } catch (err: any) {
      setToast({
        message: err.message || 'Invalid email or password.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md font-sans relative">
      
      {/* 🚀 Dynamic Fixed Toast Component UI Layer */}
      {toast.message && (
        <div 
          className={`fixed top-5 right-5 z-50 max-w-sm w-full border rounded-lg p-4 shadow-lg transition-all duration-300 transform translate-y-0 ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{toast.message}</p>
            <button 
              type="button" 
              onClick={() => setToast({ message: '', type: '' })}
              className="ml-3 text-xs font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* App Logo */}
      <div className="mb-4 text-left">
        <h2 className="text-xl font-black tracking-tight text-black">
          SprintForge
        </h2>
      </div>

      <h1 className="mb-2 text-3xl font-bold">Login</h1>

      {/* Register redirect link */}
      <p className="mb-6 text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-black underline hover:text-gray-700">
          Register
        </Link>
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded border p-3"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded border p-3 pr-12"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 hover:text-black flex items-center justify-center p-1 focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                /* Eye Closed Icon */
                <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                /* Eye Open Icon */
                <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 1 0 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 6 0Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black p-3 text-white disabled:bg-gray-400"
        >
          {loading ? 'Logging in...' : 'Login'}
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
