import React from 'react';

export type IconName =
  | 'alert'
  | 'arrowLeft'
  | 'bell'
  | 'globe'
  | 'arrowRight'
  | 'calendar'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'clipboard'
  | 'clock'
  | 'close'
  | 'configure'
  | 'copy'
  | 'cpu'
  | 'cube'
  | 'database'
  | 'eye'
  | 'expand'
  | 'file'
  | 'filter'
  | 'gear'
  | 'layers'
  | 'layers3'
  | 'loader'
  | 'lock'
  | 'mapPin'
  | 'menu'
  | 'network'
  | 'plusCircle'
  | 'precision'
  | 'reset'
  | 'review'
  | 'search'
  | 'send'
  | 'shieldCheck'
  | 'target'
  | 'technology'
  | 'trash'
  | 'upload'
  | 'users'
  | 'wallet';

const paths: Record<IconName, React.ReactNode> = {
  alert: <path d="M12 3 2.8 19h18.4L12 3Z M12 9v4m0 3h.01" />,
  arrowLeft: <path d="M19 12H5m5 5-5-5 5-5" />,
  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18Z" /></>,
  calendar: <><path d="M8 3v4m8-4v4M3.5 9h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5V12c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V5.5" /><path d="M4 12v6.5c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V12" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  clipboard: <path d="M9 5h6m-7 0H6v16h12V5h-2M9 3h6v4H9V3Z M9 12h6m-6 4h4" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3.75 2.25" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  configure: <path d="M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-5 3v4" />,
  cube: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5-8-4.5" />,
  cpu: <path d="M9 9h6v6H9zM5 10V8a2 2 0 0 1 2-2h2M19 10V8a2 2 0 0 0-2-2h-2M5 14v2a2 2 0 0 0 2 2h2M19 14v2a2 2 0 0 1-2 2h-2M9 5V3m6 2V3M9 21v-2m6 2v-2" />,
  eye: <path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Zm9.2-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
  expand: <path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M8 21H3v-5m0 5 6-6m7 6h5v-5m0 5-6-6" />,
  file: <path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6" />,
  filter: <path d="M4 5h16l-6.2 7.2V18l-3.6 2v-7.8L4 5Z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 6 9 5 9-5" />,
  layers3: <path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Zm-8 8.5 8 4.5 8-4.5M4 17l8 4.5 8-4.5" />,
  loader: <path d="M12 3v3m6.4-.4-2.1 2.1M21 12h-3m.4 6.4-2.1-2.1M12 21v-3m-6.4.4 2.1-2.1M3 12h3m-.4-6.4 2.1 2.1" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="9.5" rx="2" /><path d="M8 10.5V7a4 4 0 1 1 8 0v3.5" /></>,
  mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z M12 10a2 2 0 1 0 0-.01" />,
  review: <path d="M5 4h14v16H5V4Zm3 4h8M8 12h5m-5 4h3" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.2-4.2" /></>,
  reset: <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7M4 4v4.7h4.7" />,
  send: <path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" />,
  technology: <path d="M12 3 3 8l9 5 9-5-9-5Zm-6 8v5l6 3 6-3v-5M3 16l9 5 9-5" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.13a4 4 0 0 1 0 7.75" /></>,
  wallet: <><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M3 5a2 2 0 0 1 2-2h14v4H5a2 2 0 0 1-2-2Z" /><path d="M15 13h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a2 2 0 0 1 0-4Z" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  network: <><circle cx="5" cy="6" r="2.4" /><circle cx="19" cy="6" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M7 7.2l3.4 7M17 7.2l-3.4 7M7.4 6h9.2" /></>,
  precision: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  plusCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8m-4-4h8" /></>,
  shieldCheck: <path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3Zm-3.2 8.6 2.4 2.4 4.6-4.6" />,
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
