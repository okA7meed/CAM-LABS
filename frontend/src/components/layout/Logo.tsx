import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface LogoProps {
  className?: string;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  alt = 'CAM LABS Digital Manufacturing',
}) => {
  const { resolvedTheme } = useTheme();

  return (
    <span className={`cam-logo ${className}`} role="img" aria-label={alt}>
      <img
        src="/assets/logo.png"
        alt=""
        aria-hidden={resolvedTheme === 'light'}
        className={`cam-logo-image ${resolvedTheme === 'dark' ? 'is-active' : ''}`}
      />
      <img
        src="/assets/logo-light.png"
        alt=""
        aria-hidden={resolvedTheme === 'dark'}
        className={`cam-logo-image ${resolvedTheme === 'light' ? 'is-active' : ''}`}
      />
    </span>
  );
};
