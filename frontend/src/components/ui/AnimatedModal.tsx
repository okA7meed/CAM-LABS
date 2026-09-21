import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

/** CAM LABS easing — matches the design system's --cam-ease-out token. */
export const CAM_EASE = [0.16, 1, 0.3, 1] as const;

type AnimatedModalProps = {
  open: boolean;
  children: React.ReactNode;
  /** Extra class for the modal card (e.g. "modal-lg"). */
  cardClassName?: string;
  /** Extra class for the overlay (e.g. "auth-overlay"). */
  overlayClassName?: string;
  cardStyle?: React.CSSProperties;
  overlayStyle?: React.CSSProperties;
  role?: 'dialog' | 'alertdialog';
  ariaLabel?: string;
  onOverlayMouseDown?: React.MouseEventHandler<HTMLDivElement>;
};

/**
 * Modal surface with enter/exit motion driven by motion/react.
 * Mirrors the existing `.modal-overlay.active` + `.modal-card` structure so
 * styling is inherited unchanged; the CSS-only enter transition is neutralized
 * via the `.cam-motion` marker class so motion owns opacity/transform.
 */
export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  open,
  children,
  cardClassName,
  overlayClassName,
  cardStyle,
  overlayStyle,
  role,
  ariaLabel,
  onOverlayMouseDown,
}) => (
  <AnimatePresence>
    {open && (
<motion.div
          className={`modal-overlay active cam-motion${overlayClassName ? ` ${overlayClassName}` : ''}`}
          style={overlayStyle}
          role={role}
          aria-modal={role ? 'true' : undefined}
          aria-label={ariaLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: CAM_EASE } }}
          transition={{ duration: 0.16, ease: CAM_EASE }}
          onMouseDown={onOverlayMouseDown}
        >
          <motion.div
            className={`modal-card${cardClassName ? ` ${cardClassName}` : ''}`}
            style={cardStyle}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99, transition: { duration: 0.18, ease: CAM_EASE } }}
            transition={{ duration: 0.22, ease: CAM_EASE }}
          >
            {children}
          </motion.div>
        </motion.div>
    )}
  </AnimatePresence>
);