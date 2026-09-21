import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { fireEvent, screen } from '@testing-library/dom';
import { en } from '../../i18n/en';

// NOTE: react-i18next is hoisted to the workspace root and binds the root
// React copy, while these tests render with the frontend React copy. Mocking
// the hook keeps this test on a single React instance; the real provider
// path is covered by `tsc` + the production build + manual QA.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    i18n: { language: 'en' },
  }),
}));

import { ThemeProvider } from '../../context/ThemeContext';
import { AuthProvider } from '../../context/AuthContext';
import { StoreProvider, useStore } from '../../context/StoreContext';
import { AuthModal } from './AuthModal';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const Opener: React.FC<{ tab: 'login' | 'register' }> = ({ tab }) => {
  const { openAuthModal } = useStore();
  useEffect(() => {
    openAuthModal(tab);
  }, [openAuthModal, tab]);
  return null;
};

const renderAuthModal = (tab: 'login' | 'register') => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <Opener tab={tab} />
            <AuthModal />
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>,
    );
  });
};

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = '';
});

describe('AuthModal target redesign', () => {
  it('renders the Sign In view without the legacy tab bar', async () => {
    renderAuthModal('login');
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to access CAM LABS')).toBeInTheDocument();
    expect(screen.getByLabelText('Work Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to CAM LABS/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forgot Password?' })).toBeInTheDocument();
    // Legacy tab-bar presentation is gone.
    expect(document.querySelector('.tabs-nav')).toBeNull();
    // Brand lockup reuses the real logo asset, not recreated text.
    expect(document.querySelector('.auth-brand img[src="/assets/logo.png"]')).not.toBeNull();
  });

  it('toggles password visibility without clearing the value', async () => {
    renderAuthModal('login');
    const password = (await screen.findByLabelText('Password')) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(password, { target: { value: 'ValidPass1' } });
    });
    expect(password.type).toBe('password');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    });
    expect(password.type).toBe('text');
    expect(password.value).toBe('ValidPass1');
  });

  it('switches from Sign In to Register without a page reload', async () => {
    renderAuthModal('login');
    await screen.findByRole('heading', { name: 'Welcome Back' });
    fireEvent.click(screen.getByRole('button', { name: 'Register Account' }));
    expect(await screen.findByRole('heading', { name: 'Create Your Account' })).toBeInTheDocument();
    expect(screen.getByText('Join CAM LABS and start your manufacturing journey')).toBeInTheDocument();
  });

  it('renders the Register view with the target composition', async () => {
    renderAuthModal('register');
    await screen.findByRole('heading', { name: 'Create Your Account' });
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Work Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    // Legacy password-strength bar presentation is gone (validation stays).
    expect(screen.queryByText('Password Strength:')).toBeNull();
    // Terms are required before submission.
    fireEvent.click(screen.getByRole('button', { name: /Create Account/ }));
    expect(await screen.findByText('Please accept the Terms & NDA Protocols.')).toBeInTheDocument();
  });

  it('validates mismatched passwords inline on Register', async () => {
    renderAuthModal('register');
    await screen.findByRole('heading', { name: 'Create Your Account' });
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'jane@company.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+15550192834' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ValidPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'OtherPass1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to CAM LABS Manufacturing/ }));
    fireEvent.click(screen.getByRole('button', { name: /Create Account/ }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('exposes an accessible close control', async () => {
    renderAuthModal('login');
    await screen.findByRole('heading', { name: 'Welcome Back' });
    expect(screen.getByRole('button', { name: 'Close authentication dialog' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
