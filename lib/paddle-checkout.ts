// lib/paddle-checkout.ts
//
// Client-side Paddle.js checkout (overlay). Paddle Checkout is NOT a
// redirect — the server returns a checkout config and this module
// opens Paddle.Checkout with it. Payment proof arrives exclusively
// via Paddle webhooks; nothing here activates entitlements.
//
// Paddle.js v2: https://developer.paddle.com/paddle-js/
//   Paddle.Initialize({ token, eventCallback }) — once per page;
//     eventCallback is an INITIALIZE option (not a Checkout.open
//     option) and receives every Paddle.js checkout event.
//   Paddle.Checkout.open({ items, customer, customData, settings })
//
// Event routing: exactly one checkout promise may be pending at a
// time. Paddle.Initialize is called once per client token; the
// eventCallback resolves the active pending checkout. Events that
// arrive after a promise settles (or with no checkout open) are
// ignored.

export interface PaddleCheckoutParams {
  priceId: string;
  customerId: string;
  customData: Record<string, string>;
  // Full URL Paddle redirects to after a completed checkout.
  successUrl?: string;
}

export type PaddleCheckoutResult = 'completed' | 'closed' | 'unavailable';

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: {
        token: string;
        eventCallback?: (event: { name?: string }) => void;
      }) => void;
      Environment?: {
        set: (environment: string) => void;
      };
      Checkout: {
        open: (opts: Record<string, unknown>) => void;
      };
    };
  }
}

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

let paddleJsPromise: Promise<void> | null = null;
// Client token Paddle was initialized with — Initialize runs once
// per token so the eventCallback is registered exactly once.
let initializedToken: string | null = null;
// The single in-flight checkout, if any.
let activeCheckout: { finish: (result: PaddleCheckoutResult) => void } | null =
  null;

function loadPaddleJs(): Promise<void> {
  if (paddleJsPromise) return paddleJsPromise;
  paddleJsPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Paddle checkout requires a browser'));
      return;
    }
    if (window.Paddle) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = PADDLE_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      paddleJsPromise = null; // allow retry after a failed load
      reject(new Error('Failed to load Paddle.js'));
    };
    document.head.appendChild(script);
  });
  return paddleJsPromise;
}

/*
  Paddle.js eventCallback — registered once via Paddle.Initialize.
  Routes checkout.completed / checkout.closed to the active pending
  checkout. Events for settled or absent checkouts are ignored, so
  late/duplicate events can never resolve a future checkout.
*/
function handlePaddleEvent(event: { name?: string }): void {
  const active = activeCheckout;
  if (!active) return;
  if (event?.name === 'checkout.completed') {
    activeCheckout = null;
    active.finish('completed');
  } else if (event?.name === 'checkout.closed') {
    activeCheckout = null;
    active.finish('closed');
  }
}

function ensureInitialized(token: string): void {
  const paddle = window.Paddle;
  if (!paddle) throw new Error('Paddle.js unavailable');
  if (initializedToken === token) return;
  // Sandbox tokens require the environment to be set explicitly —
  // without it Paddle.js defaults to production and rejects the
  // sandbox-scoped token (403 invalid_client_token). Live tokens
  // already target production, so Environment.set is skipped.
  if (token.startsWith('test_')) {
    paddle.Environment?.set('sandbox');
  }
  paddle.Initialize({ token, eventCallback: handlePaddleEvent });
  initializedToken = token;
}

/*
  Open the Paddle checkout overlay. Resolves 'completed' when Paddle
  reports checkout.completed (payment submitted — subscription
  activation still flows through webhooks), 'closed' when the buyer
  dismisses the overlay without paying, or 'unavailable' when
  Paddle.js cannot be loaded/initialized/opened. Never rejects and
  never leaves the promise pending indefinitely.
*/
export async function openPaddleCheckout(
  params: PaddleCheckoutParams,
): Promise<PaddleCheckoutResult> {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) {
    return 'unavailable';
  }

  try {
    await loadPaddleJs();
    ensureInitialized(token);
  } catch {
    return 'unavailable';
  }

  const paddle = window.Paddle;
  if (!paddle?.Checkout?.open) return 'unavailable';

  /*
    A second open while one is pending replaces the overlay — settle
    the previous promise as 'closed' so callers never hang, then
    register the new checkout.
  */
  if (activeCheckout) {
    const previous = activeCheckout;
    activeCheckout = null;
    previous.finish('closed');
  }

  return new Promise<PaddleCheckoutResult>((resolve) => {
    let settled = false;
    const entry = {
      finish: (result: PaddleCheckoutResult) => {
        if (settled) return;
        settled = true;
        if (activeCheckout === entry) activeCheckout = null;
        resolve(result);
      },
    };
    activeCheckout = entry;

    try {
      paddle.Checkout.open({
        items: [{ priceId: params.priceId, quantity: 1 }],
        customer: { id: params.customerId },
        customData: params.customData,
        settings: params.successUrl
          ? { successUrl: params.successUrl }
          : undefined,
      });
    } catch {
      // Checkout.open threw synchronously — fail fast rather than
      // leaving the promise pending.
      entry.finish('unavailable');
    }
  });
}

/* Test hook — resets module state between tests. */
export function __resetPaddleCheckoutForTests(): void {
  paddleJsPromise = null;
  initializedToken = null;
  activeCheckout = null;
}
