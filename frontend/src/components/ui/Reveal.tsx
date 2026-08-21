import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

type RevealTag = 'div' | 'section' | 'footer';

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Extra delay applied before the reveal transition starts. */
  delayMs?: number;
  /** Keep the element revealed once it has entered the viewport. */
  once?: boolean;
}

interface RevealBaseProps extends RevealProps {
  as: RevealTag;
  motionClass: 'cam-reveal' | 'cam-stagger';
}

const RevealBase: React.FC<RevealBaseProps> = ({
  as,
  motionClass,
  delayMs,
  once = true,
  className,
  style,
  children,
  ...rest
}) => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({ once });

  const classNames = [motionClass, isVisible ? 'is-revealed' : null, className]
    .filter(Boolean)
    .join(' ');

  const mergedStyle = delayMs
    ? ({ ...style, '--cam-reveal-delay': `${delayMs}ms` } as React.CSSProperties)
    : style;

  const props = {
    ...rest,
    ref: ref as React.RefObject<never>,
    className: classNames,
    style: mergedStyle,
  };

  return React.createElement(as, props, children);
};

/** Fades and lifts a block of content into view on scroll. */
export const ScrollReveal: React.FC<RevealProps> = (props) => (
  <RevealBase as="div" motionClass="cam-reveal" {...props} />
);

/** Same as ScrollReveal but renders a semantic <section> element. */
export const SectionReveal: React.FC<RevealProps> = (props) => (
  <RevealBase as="section" motionClass="cam-reveal" {...props} />
);

/** Reveals direct children sequentially with a small stagger. */
export const StaggerReveal: React.FC<RevealProps> = (props) => (
  <RevealBase as="div" motionClass="cam-stagger" {...props} />
);

/** Same as ScrollReveal but renders a semantic <footer> element. */
export const FooterReveal: React.FC<RevealProps> = (props) => (
  <RevealBase as="footer" motionClass="cam-reveal" {...props} />
);
