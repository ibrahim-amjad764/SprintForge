// app/(auth)/forgot-password/page.tsx
"use client";

import PasswordResetForm from "@/components/auth/PasswordResetForm";
import AuthShell from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <PasswordResetForm />
    </AuthShell>
  );
}
