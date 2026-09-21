import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatedModal, CAM_EASE } from '../../ui/AnimatedModal';
import { Icon } from '../../ui/Icon';
import { motion } from 'motion/react';

const SESSION_KEY = 'cam-mw-mobile-notice-dismissed';

/**
 * Non-blocking recommendation shown once per session when the Manufacturing
 * Configuration / Quote Builder is opened on a mobile-sized viewport.
 * Uses the shared AnimatedModal surface, CAM LABS styling, and existing i18n.
 */
export const MobileWorkspaceNotice: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if (window.sessionStorage.getItem(SESSION_KEY)) return; } catch { /* Storage can be unavailable. */ }
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 920px)') : null;
    if (!mq) return;
    if (!mq.matches) return;
    // Small delay so the workspace paints first; never blocks usage.
    const id = window.setTimeout(() => setOpen(mq.matches), 450);
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setOpen(false);
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    return () => {
      window.clearTimeout(id);
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // Session persistence is best-effort; dismissal still works in-memory.
    }
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const body = document.body;
    const saved = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow };
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, left: `-${scrollX}px`, width: '100%', overflow: 'hidden' });
    const syncViewport = () => {
      const v = window.visualViewport;
      setViewport(v ? { left: v.offsetLeft, top: v.offsetTop, width: v.width, height: v.height } : {});
    };
    syncViewport();
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);
    const controls = () => Array.from(contentRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
    controls().at(-1)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
      if (e.key === 'Tab') {
        const buttons = controls();
        const first = buttons[0];
        const last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      Object.assign(body.style, saved);
      const html = document.documentElement;
      const behavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(scrollX, scrollY);
      html.style.scrollBehavior = behavior;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, dismiss]);

  return createPortal(
    <AnimatedModal open={open} role="dialog" ariaLabel={t('mw.mobileTitle')} overlayClassName="mw-mobile-notice-overlay" overlayStyle={viewport} cardClassName="mw-mobile-notice-card">
      <motion.div
        ref={contentRef}
        className="mw-mobile-notice cam-motion"
        role="document"
        aria-labelledby="mw-mobile-notice-title"
        aria-describedby="mw-mobile-notice-body"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: CAM_EASE }}
      >
        <button type="button" className="mw-mobile-notice-close" onClick={dismiss} aria-label={t('mw.mobileClose')}>
          <Icon name="close" size={14} />
        </button>
        <span className="mw-mobile-notice-icon" aria-hidden="true">
          <Icon name="desktop" size={26} />
        </span>
        <h2 id="mw-mobile-notice-title" className="mw-mobile-notice-title">
          {t('mw.mobileTitle')}
        </h2>
        <p id="mw-mobile-notice-body" className="mw-mobile-notice-body">
          {t('mw.mobileBody')}
        </p>
        <button type="button" className="mw-btn mw-btn-primary mw-mobile-notice-cta" onClick={dismiss}>
          {t('mw.mobileContinue')}
        </button>
      </motion.div>
    </AnimatedModal>, document.body
  );
};
