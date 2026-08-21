import React from 'react';

export type IconName =
  | 'alert'
  | 'arrowRight'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'clipboard'
  | 'close'
  | 'configure'
  | 'cube'
  | 'cpu'
  | 'eye'
  | 'expand'
  | 'file'
  | 'layers'
  | 'layers3'
  | 'loader'
  | 'review'
  | 'reset'
  | 'send'
  | 'technology'
  | 'trash'
  | 'upload';

const paths: Record<IconName, React.ReactNode> = {
  alert: <path d="M12 3 2.8 19h18.4L12 3Z M12 9v4m0 3h.01" />,
  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  clipboard: <path d="M9 5h6m-7 0H6v16h12V5h-2M9 3h6v4H9V3Z M9 12h6m-6 4h4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  configure: <path d="M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-5 3v4" />,
  cube: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5-8-4.5" />,
  cpu: <path d="M9 9h6v6H9zM5 10V8a2 2 0 0 1 2-2h2M19 10V8a2 2 0 0 0-2-2h-2M5 14v2a2 2 0 0 0 2 2h2M19 14v2a2 2 0 0 1-2 2h-2M9 5V3m6 2V3M9 21v-2m6 2v-2" />,
  eye: <path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Zm9.2-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
  expand: <path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M8 21H3v-5m0 5 6-6m7 6h5v-5m0 5-6-6" />,
  file: <path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 6 9 5 9-5" />,
  layers3: <path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Zm-8 8.5 8 4.5 8-4.5M4 17l8 4.5 8-4.5" />,
  loader: <path d="M12 3v3m6.4-.4-2.1 2.1M21 12h-3m.4 6.4-2.1-2.1M12 21v-3m-6.4.4 2.1-2.1M3 12h3m-.4-6.4 2.1 2.1" />,
  review: <path d="M5 4h14v16H5V4Zm3 4h8M8 12h5m-5 4h3" />,
  reset: <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7M4 4v4.7h4.7" />,
  send: <path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" />,
  technology: <path d="M12 3 3 8l9 5 9-5-9-5Zm-6 8v5l6 3 6-3v-5M3 16l9 5 9-5" />,
  trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6" />,
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" />,
};

export const Icon: React.FC<{ name: IconName; size?: number; label?: string; className?: string }> = ({ name, size = 18, label, className }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={label ? undefined : true}
    aria-label={label}
    role={label ? 'img' : undefined}
  >
    {paths[name]}
  </svg>
);
