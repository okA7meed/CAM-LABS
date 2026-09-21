import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { fireEvent, screen, within, waitFor } from '@testing-library/dom';
import { en } from '../../i18n/en';

// Same single-React-instance mock strategy as AuthModal.test.tsx.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      let value = (en as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) value = value.replace(`{{${k}}}`, v);
      }
      return value;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../services/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
  ApiService: {
    getCurrentUser: vi.fn(async () => null),
    forgotPassword: vi.fn(),
    verifyResetCode: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

import { ApiError, ApiService } from '../../services/api';
import { ThemeProvider } from '../../context/ThemeContext';
import { AuthProvider } from '../../context/AuthContext';
import { StoreProvider, useStore } from '../../context/StoreContext';
import { AuthModal } from './AuthModal';
import { ForgotPasswordModal, maskEmail } from './ForgotPasswordModal';

const mockedApi = ApiService as unknown as {
  forgotPassword: ReturnType<typeof vi.fn>;
  verifyResetCode: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const Opener: React.FC = () => {
  const { openForgotPassword } = useStore();
  useEffect(() => {
    openForgotPassword();
  }, [openForgotPassword]);
  return null;
};

const renderForgot = () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <Opener />
            <ForgotPasswordModal />
            <AuthModal />
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>,
    );
  });
};

const fillEmailAndSend = async (email = 'engineer@company.com') => {
  mockedApi.forgotPassword.mockResolvedValue({ message: 'ok' });
  const input = (await screen.findByLabelText('Work Email')) as HTMLInputElement;
  fireEvent.change(input, { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));
  await screen.findByRole('heading', { name: 'Verify Your Email' });
};

const fillOtp = (code: string) => {
  const boxes = screen.getAllByRole('textbox');
  expect(boxes).toHaveLength(6);
  fireEvent.change(boxes[0], { target: { value: code } });
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
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = '';
  document.documentElement.dir = 'ltr';
  vi.useRealTimers();
});

describe('ForgotPasswordModal OTP reset flow', () => {
  it('opens on the email step with no fake toast-only path', async () => {
    renderForgot();
    await screen.findByRole('heading', { name: 'Reset Your Password' });
    // Old fake wording is gone.
    expect(screen.queryByRole('button', { name: 'Send Reset Link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send Verification Code' })).toBeInTheDocument();
  });

  it('validates the email before calling the API', async () => {
    renderForgot();
    await screen.findByRole('heading', { name: 'Reset Your Password' });
    fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(mockedApi.forgotPassword).not.toHaveBeenCalled();
  });

  it('submits the email and transitions to the OTP screen with masked email', async () => {
    renderForgot();
    await fillEmailAndSend('ahmed@gmail.com');
    expect(mockedApi.forgotPassword).toHaveBeenCalledWith('ahmed@gmail.com');
    expect(screen.getByText('a••••@gmail.com')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(maskEmail('ahmed@gmail.com')).toBe('a••••@gmail.com');
  });

  it('rejects non-numeric OTP input and distributes a pasted code', async () => {
    renderForgot();
    await fillEmailAndSend();
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(boxes[0], { target: { value: 'a' } });
    expect(boxes[0].value).toBe('');
    fireEvent.change(boxes[0], { target: { value: '583921' } });
    const values = (screen.getAllByRole('textbox') as HTMLInputElement[]).map((b) => b.value);
    expect(values).toEqual(['5', '8', '3', '9', '2', '1']);
  });

  it('shows an inline error on wrong OTP without destroying the flow', async () => {
    renderForgot();
    await fillEmailAndSend();
    mockedApi.verifyResetCode.mockRejectedValue(new ApiError(401, 'Incorrect verification code.', 'INVALID_RESET_CODE'));
    fillOtp('000000');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    expect(await screen.findByText('Incorrect verification code.')).toBeInTheDocument();
    // Still on the code step, boxes intact.
    expect(screen.getByRole('heading', { name: 'Verify Your Email' })).toBeInTheDocument();
    expect((screen.getAllByRole('textbox') as HTMLInputElement[]).map((b) => b.value)).toEqual(
      ['0', '0', '0', '0', '0', '0'],
    );
  });

  it('enforces the resend cooldown, then allows resending', async () => {
    vi.useFakeTimers();
    try {
      renderForgot();
      await fillEmailAndSend();
      expect(mockedApi.forgotPassword).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Resend code in/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Resend Code' })).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(61_000);
      });
      const resend = await screen.findByRole('button', { name: 'Resend Code' });
      mockedApi.forgotPassword.mockResolvedValue({ message: 'ok' });
      fireEvent.click(resend);
      await screen.findByText('New verification code sent.');
      expect(mockedApi.forgotPassword).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('successful verification transitions to the password screen', async () => {
    renderForgot();
    await fillEmailAndSend();
    mockedApi.verifyResetCode.mockResolvedValue({ resetToken: 'challenge-id.opaque-secret', expiresInMinutes: 15 });
    fillOtp('583921');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await screen.findByRole('heading', { name: 'Create New Password' });
    expect(mockedApi.verifyResetCode).toHaveBeenCalledWith('engineer@company.com', '583921');
  });

  it('toggles password visibility and validates mismatch', async () => {
    renderForgot();
    await fillEmailAndSend();
    mockedApi.verifyResetCode.mockResolvedValue({ resetToken: 'challenge-id.opaque-secret', expiresInMinutes: 15 });
    fillOtp('583921');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await screen.findByRole('heading', { name: 'Create New Password' });

    const [next, confirm] = await screen.findAllByLabelText(/New Password|Confirm New Password/);
    const nextInput = next as HTMLInputElement;
    expect(nextInput.type).toBe('password');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    });
    expect(nextInput.type).toBe('text');

    fireEvent.change(next, { target: { value: 'ValidPass1' } });
    fireEvent.change(confirm, { target: { value: 'OtherPass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockedApi.resetPassword).not.toHaveBeenCalled();

    fireEvent.change(confirm, { target: { value: 'ValidPass1' } });
    mockedApi.resetPassword.mockResolvedValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await screen.findByRole('heading', { name: 'Password Updated' });
    expect(mockedApi.resetPassword).toHaveBeenCalledWith('challenge-id.opaque-secret', 'ValidPass1', 'ValidPass1');
  });

  it('Back to Sign In closes reset state and opens Sign In', async () => {
    renderForgot();
    await fillEmailAndSend();
    mockedApi.verifyResetCode.mockResolvedValue({ resetToken: 'challenge-id.opaque-secret', expiresInMinutes: 15 });
    fillOtp('583921');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await screen.findByRole('heading', { name: 'Create New Password' });
    fireEvent.change(await screen.findByLabelText(/^New Password/), { target: { value: 'ValidPass1' } });
    fireEvent.change(await screen.findByLabelText(/^Confirm New Password/), { target: { value: 'ValidPass1' } });
    mockedApi.resetPassword.mockResolvedValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await screen.findByRole('heading', { name: 'Password Updated' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Sign In' }));
    // Sign In experience is open and the reset dialog is gone (after exit).
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Password Updated' })).toBeNull());
  });

  it('closing the modal clears sensitive reset state', async () => {
    renderForgot();
    await fillEmailAndSend();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close authentication dialog' }));
    // AnimatePresence exit keeps the DOM briefly; wait for real removal.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Verify Your Email' })).toBeNull());
  });

  it('submits the exact OTP value in RTL mode (no reversal)', async () => {
    document.documentElement.dir = 'rtl';
    renderForgot();
    await fillEmailAndSend();
    mockedApi.verifyResetCode.mockResolvedValue({ resetToken: 'challenge-id.opaque-secret', expiresInMinutes: 15 });
    fillOtp('583921');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await screen.findByRole('heading', { name: 'Create New Password' });
    expect(mockedApi.verifyResetCode).toHaveBeenCalledWith('engineer@company.com', '583921');
  });
});
