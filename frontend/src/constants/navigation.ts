import { ViewType } from '../types';

/**
 * Canonical Request Flow route used across the app.
 * `startManufacturingRequest()` (StoreContext) sets `activeView` to this value.
 */
export const REQUEST_FLOW_VIEW: ViewType = 'manufacturing-request';

/**
 * Single source of truth for "is the user currently inside the Request Flow".
 * Used by the desktop Navbar (Header) and mobile menu (MobileNav) to hide the
 * "Start Manufacturing" button while the Request Flow is active.
 */
export const isRequestFlowView = (view: ViewType): boolean => view === REQUEST_FLOW_VIEW;
