import React from 'react';

export type IconName =
  | 'alert'
  | 'arrowLeft'
  | 'bell'
  | 'globe'
  | 'arrowRight'
  | 'calculator'
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
  | 'dimensionX'
  | 'dimensionY'
  | 'dimensionZ'
  | 'dotsVertical'
  | 'download'
  | 'eye'
  | 'eyeOff'
  | 'mail'
  | 'phone'
  | 'building'
  | 'card'
  | 'coupon'
  | 'expand'
  | 'file'
  | 'fileClock'
  | 'filter'
  | 'folder'
  | 'gear'
  | 'factory'
  | 'heart'
  | 'home'
  | 'infinity'
  | 'info'
  | 'cart'
  | 'chart'
  | 'userRound'
  | 'layers'
  | 'layers3'
  | 'loader'
  | 'lock'
  | 'mapPin'
  | 'menu'
  | 'network'
  | 'package'
  | 'percent'
  | 'plusCircle'
  | 'precision'
  | 'reset'
  | 'review'
  | 'save'
  | 'pencil'
  | 'bolt'
  | 'search'
  | 'send'
  | 'scaling'
  | 'sliders'
  | 'sortList'
  | 'shieldCheck'
  | 'surface'
  | 'tag'
  | 'target'
  | 'technology'
  | 'trash'
  | 'trendUp'
  | 'truck'
  | 'upload'
  | 'userGear'
  | 'users'
  | 'wallet'
  | 'linkedin'
  | 'youtube'
  | 'instagram'
  | 'desktop'
  | 'headset'
  | 'key'
  | 'message'
  | 'megaphone'
  | 'moon'
  | 'plus';

const paths: Record<IconName, React.ReactNode> = {
  alert: <path d="M12 3 2.8 19h18.4L12 3Z M12 9v4m0 3h.01" />,
  arrowLeft: <path d="M19 12H5m5 5-5-5 5-5" />,
  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18Z" /></>,
  calendar: <><path d="M8 3v4m8-4v4M3.5 9h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01" /></>,
  calculator: <><rect x="5.5" y="3" width="13" height="18" rx="2" /><path d="M9 3v3M15 3v3M9 11h6M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.5h.01M12 18.5h.01M15.5 18.5h.01" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5V12c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V5.5" /><path d="M4 12v6.5c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V12" /></>,
  dimensionX: <path d="M4 12h16m-7-5 5 5-5 5M13 7l-5 5 5 5" />,
  dimensionY: <path d="M12 4v16m-5-7 5 5 5-5M7 13l5-5 5 5" />,
  dimensionZ: <path d="M6 18 18 6M13 6h5v5M11 18H6v-5" />,
  dotsVertical: <path d="M12 5.5h.01M12 12h.01M12 18.5h.01" />,
  download: <path d="M12 4v9m0 0 4-4m-4 4L8 9M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />,
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
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c5.8 0 9.2 7 9.2 7a17 17 0 0 1-3 3.7M6.6 6.6A16.4 16.4 0 0 0 2.8 12S6.2 18 12 18c1.2 0 2.3-.3 3.3-.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M10 21v-3h4v3" /></>,
  expand: <path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M8 21H3v-5m0 5 6-6m7 6h5v-5m0 5-6-6" />,
  file: <path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6" />,
  filter: <path d="M4 5h16l-6.2 7.2V18l-3.6 2v-7.8L4 5Z" />,
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 8.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V8.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8.5h.01" /></>,
  factory: <><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M17 18h1M12 18h1M7 18h1" /></>,
  heart: <path d="M12 20.5s-7.5-4.7-9.3-9.2C1.5 8.6 3.3 5.5 6.2 5.5c2 0 3.4 1.1 5.8 3.7 2.4-2.6 3.8-3.7 5.8-3.7 2.9 0 4.7 3.1 3.5 5.8-1.8 4.5-9.3 9.2-9.3 9.2Z" />,
  cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 3h2l2.5 12.4a1 1 0 0 0 1 .6h8.9a1 1 0 0 0 1-.8L20.5 8H6" /></>,
  chart: <><path d="M3 21h18" /><path d="M7 17v-5m5 5V7m5 10v-8" /></>,
  userRound: <><circle cx="12" cy="8" r="3.8" /><path d="M5 20v-1a7 7 0 0 1 14 0v1" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 6 9 5 9-5" />,
  layers3: <path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Zm-8 8.5 8 4.5 8-4.5M4 17l8 4.5 8-4.5" />,
  loader: <path d="M12 3v3m6.4-.4-2.1 2.1M21 12h-3m.4 6.4-2.1-2.1M12 21v-3m-6.4.4 2.1-2.1M3 12h3m-.4-6.4 2.1 2.1" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="9.5" rx="2" /><path d="M8 10.5V7a4 4 0 1 1 8 0v3.5" /></>,
  mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z M12 10a2 2 0 1 0 0-.01" />,
  review: <path d="M5 4h14v16H5V4Zm3 4h8M8 12h5m-5 4h3" />,
  pencil: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>,
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.2-4.2" /></>,
  reset: <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7M4 4v4.7h4.7" />,
  send: <path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" />,
  scaling: <><rect x="4.5" y="4.5" width="15" height="15" rx="2" /><path d="M12 3v2.5m0 13V21M3 12h2.5m13 0H21" /></>,
  surface: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="m8 16 8-8M16 13v3h-3" /></>,
  technology: <path d="M12 3 3 8l9 5 9-5-9-5Zm-6 8v5l6 3 6-3v-5M3 16l9 5 9-5" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.13a4 4 0 0 1 0 7.75" /></>,
  wallet: <><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M3 5a2 2 0 0 1 2-2h14v4H5a2 2 0 0 1-2-2Z" /><path d="M15 13h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a2 2 0 0 1 0-4Z" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  card: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18M7 15h4" /></>,
  coupon: <><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z" /><path d="M13.5 7v1.2m0 2.1v1.2m0 2.1v1.2" strokeDasharray="1.4 1.6" /><path d="M16.8 9.6l-1.6 4M16.1 9.8h.01M15.3 14.2h.01" /></>,
  fileClock: <><path d="M6 3h8l4 4v14H6V3Zm8 0v5h4" /><circle cx="12" cy="14.5" r="3.4" /><path d="M12 12.8v1.9l1.3.9" /></>,
  infinity: <path d="M12 12c-1.8-2.3-3.6-3.7-5.6-3.7a3.9 3.9 0 1 0 0 7.8c2 0 3.8-1.4 5.6-3.7 1.8 2.3 3.6 3.7 5.6 3.7a3.9 3.9 0 1 0 0-7.8c-2 0-3.8 1.4-5.6 3.7Z" />,
  package: <><path d="M4 8.5 12 4l8 4.5v9L12 21.5 4 17v-8.5Z" /><path d="M4 8.5 12 13l8-4.5M12 13v8.5M8.5 6 16 10.2" /></>,
  percent: <><path d="M19 5 5 19" /><circle cx="6.8" cy="6.8" r="2.3" /><circle cx="17.2" cy="17.2" r="2.3" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  sliders: <><path d="M4 7h8m4 0h4M4 12h2m4 0h10M4 17h12" /><circle cx="14" cy="7" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="17" r="2" /></>,
  sortList: <><path d="M4 6h8M4 11h5M4 16h3" /><path d="M17 4v12m0 0 3-3m-3 3-3-3" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  trendUp: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  truck: <><path d="M2 6h12v10H2V6Z" /><path d="M14 10h4l4 4v2h-8v-6Z" /><circle cx="6.5" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></>,
  userGear: <><circle cx="10" cy="8" r="3.2" /><path d="M3.5 19.5v-.5a6 6 0 0 1 9.3-5" /><circle cx="17" cy="17" r="2.5" /><path d="M17 13.6v1.3m3 1.1-1.2.4m-.4 3-1.2-.4m-3 .4 1.2-.4m.4-3 1.2.4" /></>,
  network: <><circle cx="5" cy="6" r="2.4" /><circle cx="19" cy="6" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M7 7.2l3.4 7M17 7.2l-3.4 7M7.4 6h9.2" /></>,
  precision: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  plusCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8m-4-4h8" /></>,
  shieldCheck: <path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3Zm-3.2 8.6 2.4 2.4 4.6-4.6" />,
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" />,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V17M8 7.4h.01M12 17v-3.6a1.9 1.9 0 0 1 3.8 0V17M12 10.7V17" /></>,
  youtube: <><rect x="2.8" y="5.5" width="18.4" height="13" rx="3.5" /><path d="m10.3 9.3 4.8 2.7-4.8 2.7V9.3Z" /></>,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="3.8" /><path d="M17.2 6.8h.01" /></>,
  desktop: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6m-3-4v4" /></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="7" rx="1.5" /><rect x="17" y="13" width="4" height="7" rx="1.5" /><path d="M20 20a4 4 0 0 1-4 2h-2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-3 3 2.5 2.5M13.5 10.5 16 13" /></>,
  message: <><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></>,
  megaphone: <><path d="m3 11 14-5v12L3 13v-2Z" /><path d="M7 13.5V18a1.5 1.5 0 0 0 3 0v-3.2M17 8.5a4 4 0 0 1 0 7" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
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
