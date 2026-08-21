import { useEffect, useRef, useState } from 'react';

interface ScrollRevealOptions {
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
  /** Root margin passed to the IntersectionObserver. */
  rootMargin?: string;
  /** When true the element stays revealed after the first intersection. */
  once?: boolean;
}

/**
 * Viewport-driven reveal primitive built on IntersectionObserver.
 * Returns a ref to attach to the target element and its current reveal state.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(options: ScrollRevealOptions = {}) {
  const { threshold = 0, rootMargin = '0px 0px -12% 0px', once = true } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Without observer support the content must never stay hidden.
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setIsVisible(false);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}
