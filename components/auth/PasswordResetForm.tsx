// // components/Auth/PasswordResetForm.tsx
// import React, { useState } from 'react';

// const PasswordResetForm: React.FC = () => {
//   const [email, setEmail] = useState<string>('');
//   const [message, setMessage] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const handlePasswordReset = async (event: React.FormEvent) => {
//     event.preventDefault();
//     setMessage(null);
//     setError(null);

//     try {
//       // Simulated API request for password reset.
//       // Replace the following line with actual API integration.
//       console.log('Sending password reset request for:', email);
//       setMessage('Password reset link has been sent to your email.');
//     } catch (err) {
//       setError('Failed to send password reset email. Please try again.');
//     }
//   };

//   return (
//     <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
//       <h2 className="text-2xl mb-4">Reset Your Password</h2>
//       <form onSubmit={handlePasswordReset} className="space-y-4">
//         {message && <div className="text-green-500">{message}</div>}
//         {error && <div className="text-red-500">{error}</div>}
//         <div>
//           <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
//           <input
//             type="email"
//             id="email"
//             className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />
//         </div>
//         <button
//           type="submit"
//           className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
//         >
//           Send Reset Link
//         </button>
//       </form>
//     </div>
//   );
// };

// export default PasswordResetForm;

'use client';

import { useState } from 'react';

export default function PasswordResetForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(`Password reset link will be sent to ${email}.`);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-3xl font-bold">Reset Password</h1>
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
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border p-3"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full rounded bg-black p-3 text-white"
        >
          Send reset link
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
    </div>
  );
}

// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';

// export default function ForgotPasswordForm() {
//   const [email, setEmail] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [sent, setSent] = useState(false);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     // Simulate API call
//     setTimeout(() => {
//       setLoading(false);
//       setSent(true);
//       // Add your forgot password logic here
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
//             Reset password
//           </h1>
//           <p className="text-[#A1A1AA] mt-3 text-sm leading-relaxed">
//             {sent
//               ? 'Check your inbox for the reset link'
//               : 'Enter your email and we\'ll send you a reset link'
//             }
//           </p>
//         </div>

//         {/* Form Card */}
//         <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8">
//           {sent ? (
//             /* Success state */
//             <div className="text-center">
//               <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
//                 <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
//                 </svg>
//               </div>
//               <h3 className="text-lg font-medium text-white mb-2">Email sent!</h3>
//               <p className="text-sm text-[#A1A1AA] leading-relaxed mb-6">
//                 We&apos;ve sent a password reset link to{' '}
//                 <span className="text-[#D4D4D8] font-medium">{email}</span>.
//                 Please check your inbox and follow the instructions.
//               </p>
//               <div className="flex flex-col gap-3">
//                 <button
//                   type="button"
//                   onClick={() => setSent(false)}
//                   className="w-full py-3 px-6 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-[#D4D4D8] text-sm font-medium rounded-xl transition-all duration-300"
//                 >
//                   Try a different email
//                 </button>
//                 <Link
//                   href="/login"
//                   className="w-full py-3 px-6 bg-[#FF4F30] hover:bg-[#FF4F30]/90 text-white text-sm font-semibold rounded-xl transition-all duration-300 text-center inline-block"
//                 >
//                   Back to sign in
//                 </Link>
//               </div>
//               <p className="text-xs text-[#52525B] mt-5">
//                 Didn&apos;t receive the email? Check your spam folder or{' '}
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setSent(false);
//                     setEmail('');
//                   }}
//                   className="text-[#FF4F30] hover:text-[#FF4F30]/80 transition-colors duration-300"
//                 >
//                   try again
//                 </button>
//               </p>
//             </div>
//           ) : (
//             /* Form state */
//             <>
//               {error && (
//                 <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
//                   {error}
//                 </div>
//               )}

//               <form onSubmit={handleSubmit} className="space-y-5">
//                 {/* Email */}
//                 <div>
//                   <label htmlFor="email" className="block text-sm font-medium text-[#D4D4D8] mb-2">
//                     Email address
//                   </label>
//                   <input
//                     id="email"
//                     type="email"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     required
//                     placeholder="you@example.com"
//                     className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-[#52525B] text-sm focus:outline-none focus:border-[#FF4F30]/50 focus:ring-1 focus:ring-[#FF4F30]/30 transition-all duration-300"
//                   />
//                 </div>

//                 {/* Submit */}
//                 <button
//                   type="submit"
//                   disabled={loading}
//                   className="w-full py-3 px-6 bg-[#FF4F30] hover:bg-[#FF4F30]/90 text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   {loading ? (
//                     <span className="flex items-center justify-center gap-2">
//                       <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
//                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
//                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
//                       </svg>
//                       Sending...
//                     </span>
//                   ) : (
//                     'Send reset link'
//                   )}
//                 </button>
//               </form>

//               {/* Hint */}
//               <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
//                 <div className="flex gap-3">
//                   <svg className="w-5 h-5 text-[#52525B] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                     <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
//                   </svg>
//                   <p className="text-xs text-[#52525B] leading-relaxed">
//                     Enter the email address associated with your account and we&apos;ll send you a link to reset your password. The link will expire in 15 minutes.
//                   </p>
//                 </div>
//               </div>
//             </>
//           )}
//         </div>

//         {/* Footer link */}
//         <p className="text-center text-sm text-[#52525B] mt-8">
//           Remember your password?{' '}
//           <Link href="/login" className="text-[#FF4F30] hover:text-[#FF4F30]/80 font-medium transition-colors duration-300">
//             Sign in
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }
