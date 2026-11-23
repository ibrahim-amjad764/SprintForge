// __tests__/unit/components/theme.test.ts
//
// Phase 8: theme resolution logic — stored preference wins over the
// OS preference; invalid/missing values fall back to system then
// light. Mirrors the anti-flash script in app/layout.tsx.

import { describe, it, expect } from '@jest/globals';
import { resolveTheme } from '@/components/theme/ThemeProvider';

describe('resolveTheme', () => {
  it('returns stored dark preference regardless of system setting', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('returns stored light preference regardless of system setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('falls back to system preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('ignores invalid stored values and uses system preference', () => {
    expect(resolveTheme('sepia', true)).toBe('dark');
    expect(resolveTheme('sepia', false)).toBe('light');
    expect(resolveTheme('', true)).toBe('dark');
  });
});
