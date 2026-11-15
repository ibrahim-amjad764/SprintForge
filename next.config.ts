import type { NextConfig } from "next";

/*
Content-Security-Policy — REPORT-ONLY (Batch 4)

Enforcement is intentionally deferred until violations are verified
in dev/staging. Expected allowances:
- script-src 'unsafe-inline'/'unsafe-eval': Next.js App Router injects
  inline hydration bootstrap (__next_f) and dev tooling requires eval.
  A nonce-based policy is a future hardening step.
- style-src 'unsafe-inline': Tailwind/inline style attributes.
- img-src res.cloudinary.com: attachment/logo URLs are served from
  Cloudinary CDN.
- connect-src ws:/wss:: Socket.IO realtime connections.
- Stripe: checkout redirects to Stripe-hosted pages (no js.stripe.com
  on this origin); webhook is server-to-server.
*/
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=()",
          },
          {
            // HSTS — ignored by browsers over plain HTTP, enforced on HTTPS
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Report-Only: violations surface in the browser console
            // without blocking anything until compatibility is verified.
            key: "Content-Security-Policy-Report-Only",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
