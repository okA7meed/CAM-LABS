import React, { useEffect, useMemo, useState } from 'react';
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

  // Normalize the phrase list once. This keeps the animation operating on valid,
  // non-empty entries and gives us a stable reference for the effect deps so the
  // typewriter cycle is never broken by a new array identity.
  const safePhrases = useMemo(
    () => phrases.map((phrase) => String(phrase ?? '')).filter((phrase) => phrase.length > 0),
    [phrases],
  );

  // First valid phrase, used as a safe fallback so the animated line degrades to
  // real text whenever the animation state can't produce any (see render below).
  const fallbackPhrase = safePhrases[0] ?? '';

  useEffect(() => {
    if (safePhrases.length === 0) return;

    // Reduced motion: swap whole phrases instead of typing them out.
    if (prefersReducedMotion) {
      if (safePhrases.length < 2) return;
      const swapTimer = window.setTimeout(
        () => setIndex((current) => (current + 1) % safePhrases.length),
        holdMs + 800,
      );
      return () => window.clearTimeout(swapTimer);
    }

    const phrase = safePhrases[index % safePhrases.length];
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
        setIndex((current) => (current + 1) % safePhrases.length);
        setPhase('typing');
        return;
      }
      setCharCount((current) => current - 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [index, charCount, phase, safePhrases, prefersReducedMotion, typeMs, deleteMs, holdMs, gapMs]);

  const phrase = safePhrases[index % safePhrases.length] ?? '';
  const typedText = prefersReducedMotion ? phrase : phrase.slice(0, charCount);
  // The typewriter briefly passes through an empty gap while switching phrases.
  // That transient state is intended and safe (the caret is hidden during it), so
  // only fall back to a real phrase when there are no valid phrases at all — i.e.
  // the animation genuinely cannot produce text. This guarantees the animated line
  // is never left permanently empty while keeping the delete/type cycle flicker-free.
  const hasValidPhrase = safePhrases.length > 0;
  const visibleText = hasValidPhrase ? typedText : fallbackPhrase;
  // The cursor must only ever appear while there is real text on the line, so it is
  // never left blinking on its own over an empty second line (typing/gap states).
  const showCaret = visibleText.length > 0 && !prefersReducedMotion && hasValidPhrase;

  return (
    <span className={['cam-headline', className].filter(Boolean).join(' ')}>
      {safePhrases.map((ghost) => (
        <span className="cam-headline-ghost" aria-hidden="true" key={ghost}>
          {ghost}
        </span>
      ))}
      <span className="cam-headline-phrase">
        {visibleText}
        {showCaret && <span className="cam-headline-caret" aria-hidden="true" />}
      </span>
    </span>
  );
};
