'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedStatProps {
  /** Final numeric value to count up to */
  value: number;
  /** Suffix rendered after the number, e.g. '%', '+', 'k+' handled via format */
  suffix?: string;
  /** Decimal places */
  decimals?: number;
  /** Optional prefix, e.g. '$' */
  prefix?: string;
  duration?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/*
 * Count-up stat — animates once when scrolled into view via
 * IntersectionObserver + rAF. Transform-free (text content only),
 * honors prefers-reduced-motion by rendering the final value instantly.
 */
export default function AnimatedStat({
  value,
  suffix = '',
  decimals = 0,
  prefix = '',
  duration = 1100,
}: AnimatedStatProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // Async via rAF — avoids synchronous setState in the effect body.
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  useEffect(() => {
    if (!started) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value, duration]);

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
