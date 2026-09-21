import React from 'react';
import { AccountSettingsView } from '../account/AccountSettingsView';

/**
 * Customer Account Settings entry point (route: `profile`).
 *
 * Previously "Account & Engineering Preferences" with Personal / Manufacturing
 * / Security / API tabs. The manufacturing defaults and API sections were
 * removed from this navigation per the approved account-center IA — the
 * underlying stored preferences are untouched. All account UI now lives in
 * `components/account/`.
 */
export const ProfileView: React.FC = () => <AccountSettingsView />;
