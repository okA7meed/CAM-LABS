import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';

const SEPARATOR_KEY = 'betaNotice.separator';

export const BetaAnnouncementBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setActiveView } = useStore();
  const prefersReducedMotion = usePrefersReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isRTL = i18n.language === 'ar';

  const navigateToContact = () => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setActiveView('contact');
  };

  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (barRef.current && trackRef.current) {
        setTrackWidth(trackRef.current.scrollWidth);
      }
    };
    updateDimensions();
    const ro = new ResizeObserver(updateDimensions);
    if (barRef.current) ro.observe(barRef.current);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', updateDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const MARQUEE_SPEED_PX_PER_SECOND = 85;

  const animationDuration = trackWidth > 0
    ? Math.max(14, trackWidth / (2 * MARQUEE_SPEED_PX_PER_SECOND))
    : 15;

  const animationDirection = isRTL ? 'marquee-rtl' : 'marquee-ltr';

  const trackStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    willChange: 'transform',
    animation: prefersReducedMotion ? 'none' : `${animationDirection} ${animationDuration}s linear infinite`,
    animationPlayState: prefersReducedMotion ? 'paused' : 'running',
  } as React.CSSProperties;

  const getMessageParts = () => {
    const isMobileView = isMobile;
    const messageKey = isMobileView ? 'betaNotice.mobile' : 'betaNotice.desktop';
    const supportKey = 'betaNotice.support';

    return {
      primary: t(messageKey),
      support: t(supportKey),
      separator: t(SEPARATOR_KEY),
    };
  };

  const { primary, support, separator } = getMessageParts();

  const messageHtml = (
    <>
      <span className="beta-message-primary">{primary}</span>
      <button
        className="beta-support-link"
        type="button"
        onClick={navigateToContact}
        aria-label={isRTL ? 'التواصل مع خدمة العملاء' : 'Contact Customer Support'}
      >
        {support}
        <Icon name="arrowRight" size={10} className="beta-support-icon" aria-hidden="true" />
      </button>
    </>
  );

  const renderTrack = () => (
    <div className="beta-track" ref={trackRef} style={trackStyle}>
      <div className="beta-message-group" aria-hidden="true">{messageHtml}</div>
      <span className="beta-separator" aria-hidden="true">{separator}</span>
      <div className="beta-message-group" aria-hidden="true">{messageHtml}</div>
      <span className="beta-separator" aria-hidden="true">{separator}</span>
      <div className="beta-message-group" aria-hidden="true">{messageHtml}</div>
      <span className="beta-separator" aria-hidden="true">{separator}</span>
      <div className="beta-message-group" aria-hidden="true">{messageHtml}</div>
    </div>
  );

  if (!isMounted) {
    return (
      <div
        ref={barRef}
        className="beta-announcement-bar"
        role="status"
        aria-live="polite"
        aria-label={isRTL ? 'إشعار النسخة التجريبية' : 'Beta announcement'}
      >
        <div className="beta-viewport">{renderTrack()}</div>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      className="beta-announcement-bar"
      role="status"
      aria-live="polite"
      aria-label={isRTL ? 'إشعار النسخة التجريبية' : 'Beta announcement'}
    >
      <div className="beta-viewport">{renderTrack()}</div>
      <div className="beta-announcement-sr-only" aria-live="polite">
        {primary}{' '}{support}
      </div>
    </div>
  );
};