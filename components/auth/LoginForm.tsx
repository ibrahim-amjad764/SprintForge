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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                /* Eye Open Icon */
                <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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
  
// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';

// export default function LoginForm() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     // Simulate API call
//     setTimeout(() => {
//       setLoading(false);
//       // Add your login logic here
//     }, 1500);
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4 py-12 relative overflow-hidden">
//       {/* Background glow */}
//       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF4F30] rounded-full blur-[200px] opacity-[0.04] pointer-events-none" />

//       <div className="w-full max-w-md relative z-10">
//         {/* Logo */}
//         <div className="text-center mb-10">
//           <Link href="/" className="inline-flex items-center gap-2 mb-6">
//             <div className="w-10 h-10 rounded-xl bg-[#FF4F30] flex items-center justify-center">
//               <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
//               </svg>
//             </div>
//             <span className="text-white text-xl font-semibold tracking-tight">Brand</span>
//           </Link>
//           <h1 className="text-3xl md:text-4xl font-medium text-white tracking-tight">
//             Welcome back
//           </h1>
//           <p className="text-[#A1A1AA] mt-3 text-sm leading-relaxed">
//             Sign in to your account to continue
//           </p>
//         </div>

//         {/* Form Card */}
//         <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8">
//           {error && (
//             <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
//               {error}
//             </div>
//           )}

//           <form onSubmit={handleSubmit} className="space-y-5">
//             {/* Email */}
//             <div>
//               <label htmlFor="email" className="block text-sm font-medium text-[#D4D4D8] mb-2">
//                 Email address
//               </label>
//               <input
//                 id="email"
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 required
//                 placeholder="you@example.com"
//                 className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-[#52525B] text-sm focus:outline-none focus:border-[#FF4F30]/50 focus:ring-1 focus:ring-[#FF4F30]/30 transition-all duration-300"
//               />
//             </div>

//             {/* Password */}
//             <div>
//               <div className="flex items-center justify-between mb-2">
//                 <label htmlFor="password" className="block text-sm font-medium text-[#D4D4D8]">
//                   Password
//                 </label>
//                 <Link
//                   href="/forgot-password"
//                   className="text-xs text-[#FF4F30] hover:text-[#FF4F30]/80 transition-colors duration-300"
//                 >
//                   Forgot password?
//                 </Link>
//               </div>
//               <div className="relative">
//                 <input
//                   id="password"
//                   type={showPassword ? 'text' : 'password'}
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   required
//                   placeholder="••••••••"
//                   className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-[#52525B] text-sm focus:outline-none focus:border-[#FF4F30]/50 focus:ring-1 focus:ring-[#FF4F30]/30 transition-all duration-300 pr-12"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA] transition-colors duration-300"
//                 >
//                   {showPassword ? (
//                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
//                     </svg>
//                   ) : (
//                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//                     </svg>
//                   )}
//                 </button>
//               </div>
//             </div>

//             {/* Remember me */}
//             <div className="flex items-center gap-2">
//               <input
//                 id="remember"
//                 type="checkbox"
//                 className="w-4 h-4 rounded border-white/[0.15] bg-white/[0.05] text-[#FF4F30] focus:ring-[#FF4F30]/30 focus:ring-offset-0 cursor-pointer"
//               />
//               <label htmlFor="remember" className="text-sm text-[#A1A1AA] cursor-pointer">
//                 Remember me for 30 days
//               </label>
//             </div>

//             {/* Submit */}
//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full py-3 px-6 bg-[#FF4F30] hover:bg-[#FF4F30]/90 text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
//             >
//               {loading ? (
//                 <span className="flex items-center justify-center gap-2">
//                   <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
//                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
//                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
//                   </svg>
//                   Signing in...
//                 </span>
//               ) : (
//                 'Sign in'
//               )}
//             </button>
//           </form>

//           {/* Divider */}
//           <div className="relative my-6">
//             <div className="absolute inset-0 flex items-center">
//               <div className="w-full border-t border-white/[0.08]" />
//             </div>
//             <div className="relative flex justify-center text-xs">
//               <span className="px-3 bg-[#0F0F0F] text-[#52525B]">or continue with</span>
//             </div>
//           </div>

//           {/* Social buttons */}
//           <div className="grid grid-cols-2 gap-3">
//             <button
//               type="button"
//               className="flex items-center justify-center gap-2 py-3 px-4 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[#D4D4D8] text-sm hover:bg-white/[0.08] transition-all duration-300"
//             >
//               <svg className="w-5 h-5" viewBox="0 0 24 24">
//                 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
//                 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
//                 <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
//                 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
//               </svg>
//               Google
//             </button>
//             <button
//               type="button"
//               className="flex items-center justify-center gap-2 py-3 px-4 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[#D4D4D8] text-sm hover:bg-white/[0.08] transition-all duration-300"
//             >
//               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
//                 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
//               </svg>
//               GitHub
//             </button>
//           </div>
//         </div>

//         {/* Footer link */}
//         <p className="text-center text-sm text-[#52525B] mt-8">
//           Don&apos;t have an account?{' '}
//           <Link href="/register" className="text-[#FF4F30] hover:text-[#FF4F30]/80 font-medium transition-colors duration-300">
//             Create one
//           </Link>
//         </p>
//       </div>
//     </div>00
//   );
// }
