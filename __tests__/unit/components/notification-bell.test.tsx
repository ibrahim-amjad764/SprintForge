// __tests__/unit/components/notification-bell.test.tsx
//
// SSR smoke test — verifies the bell renders with the polling layer
// wired in. Interactive polling/sockets are covered by
// __tests__/unit/lib/polling.test.ts and e2e.

import { describe, it, expect } from '@jest/globals';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import NotificationBell from '@/components/notifications/NotificationBell';

describe('NotificationBell', () => {
  it('renders the bell button without crashing', () => {
    const html = renderToStaticMarkup(
      createElement(NotificationBell, { userId: 'user-1' }),
    );
    expect(html).toContain('🔔');
  });
});
