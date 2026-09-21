import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface LogoProps {
  className?: string;
  alt?: string;
  /**
   * Force a variant regardless of the current theme. Needed on surfaces
   * with a fixed background (e.g. the always-dark footer in light mode).
   */
  forceTheme?: 'dark' | 'light';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  alt = 'CAM LABS Digital Manufacturing',
  forceTheme,
}) => {
  const { resolvedTheme } = useTheme();
  const theme = forceTheme ?? resolvedTheme;

  return (
    <span className={`cam-logo ${className}`} role="img" aria-label={alt}>
      <img
        src="/assets/logo.png"
        alt=""
        aria-hidden={theme === 'light'}
        className={`cam-logo-image ${theme === 'dark' ? 'is-active' : ''}`}
      />
      <img
        src="/assets/logo-light.png"
        alt=""
        aria-hidden={theme === 'dark'}
        className={`cam-logo-image ${theme === 'light' ? 'is-active' : ''}`}
      />
    </span>
  );
};
