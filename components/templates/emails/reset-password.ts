// templates/emails/reset-password.ts

export function resetPasswordEmail(
  name: string,
  url: string
) {
  return `
<h2>Hello ${name}</h2>

<p>You requested a password reset.</p>

<p>Click below:</p>

<a href="${url}">Reset Password</a>

<p>This link expires soon.</p>
`;
}