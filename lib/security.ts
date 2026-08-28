// lib/security.ts

import crypto from 'crypto';

/*
Security Utilities

Used for:
- Tokens
- Hashing
- Secure IDs
*/

export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
