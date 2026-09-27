'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export const observeActivity = (
  el: Element,
  onChange: (active: boolean) => void,
): (() => void) => {
  let inView = true;
  let pageVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
  let active = inView && pageVisible;

  const sync = () => {
    const next = inView && pageVisible;
    if (next === active) return;
    active = next;
    onChange(next);
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1]?.isIntersecting ?? true;
      sync();
    });
    observer.observe(el);
  }

  const onVisibility = () => {
    if (typeof document !== 'undefined') {
      pageVisible = document.visibilityState === 'visible';
      sync();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    observer?.disconnect();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
};

export const useInView = (
  ref: RefObject<Element | null>,
  onChange?: (active: boolean) => void,
): RefObject<boolean> => {
  const activeRef = useRef(true);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unobserve = observeActivity(el, (active) => {
      activeRef.current = active;
      onChangeRef.current?.(active);
    });
    return () => {
      unobserve();
      activeRef.current = true;
    };
  }, [ref]);

  return activeRef;
};
