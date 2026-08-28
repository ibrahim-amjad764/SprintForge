// app/(auth)/forgot-password/page.tsx
"use client";

import PasswordResetForm from "../../../components/auth/PasswordResetForm";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <PasswordResetForm />
    </main>
  );
}
