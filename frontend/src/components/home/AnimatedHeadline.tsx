import React, { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface AnimatedHeadlineProps {
  phrases: string[];
  className?: string;
  /** Delay between typed characters. */
  typeMs?: number;
  /** Delay between erased characters. */
  deleteMs?: number;
  /** How long a fully typed phrase stays on screen. */
  holdMs?: number;
  /** Pause on the empty state before the next phrase starts typing. */
  gapMs?: number;
}

type Phase = 'typing' | 'deleting';

/**
 * Infinite typewriter headline. Hidden ghost copies of every phrase reserve the
 * widest and tallest variant so the hero layout never shifts while typing.
 */
export const AnimatedHeadline: React.FC<AnimatedHeadlineProps> = ({
  phrases,
  className,
  typeMs = 95,
  deleteMs = 45,
  holdMs = 2000,
  gapMs = 140,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');

  useEffect(() => {
    if (phrases.length === 0) return;

    // Reduced motion: swap whole phrases instead of typing them out.
    if (prefersReducedMotion) {
      if (phrases.length < 2) return;
      const swapTimer = window.setTimeout(
        () => setIndex((current) => (current + 1) % phrases.length),
        holdMs + 800,
      );
      return () => window.clearTimeout(swapTimer);
    }

    const phrase = phrases[index % phrases.length];
    const isTyping = phase === 'typing';
    const isAtEdge = isTyping ? charCount >= phrase.length : charCount <= 0;
    const delay = isAtEdge ? (isTyping ? holdMs : gapMs) : isTyping ? typeMs : deleteMs;

    const timer = window.setTimeout(() => {
      if (isTyping) {
        if (isAtEdge) setPhase('deleting');
        else setCharCount((current) => current + 1);
        return;
      }
      if (isAtEdge) {
        setIndex((current) => (current + 1) % phrases.length);
        setPhase('typing');
        return;
      }
      setCharCount((current) => current - 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [index, charCount, phase, phrases, prefersReducedMotion, typeMs, deleteMs, holdMs, gapMs]);

  const phrase = phrases[index % phrases.length] ?? '';
  const visibleText = prefersReducedMotion ? phrase : phrase.slice(0, charCount);

  return (
    <span className={['cam-headline', className].filter(Boolean).join(' ')}>
      {phrases.map((ghost) => (
        <span className="cam-headline-ghost" aria-hidden="true" key={ghost}>
          {ghost}
          <span className="cam-headline-caret" />
        </span>
      ))}
      <span className="cam-headline-phrase">
        {visibleText}
        <span className="cam-headline-caret" aria-hidden="true" />
      </span>
    </span>
  );
};
