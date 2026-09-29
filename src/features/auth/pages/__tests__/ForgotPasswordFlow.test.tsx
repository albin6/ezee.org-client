import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { authService } from '../../services/auth.service';

vi.mock('../../services/auth.service', () => ({
  authService: {
    requestPasswordResetLink: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

describe('Forgot Password & Reset Password Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ForgotPasswordPage', () => {
    it('renders email input and Send Reset Link button initially', () => {
      render(
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/name@company\.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument();
    });

    it('submits email and displays confirmation message instructing user to check email', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.requestPasswordResetLink).mockResolvedValueOnce({
        status: 'success',
        message: 'A password reset link has been sent to your email address.',
        data: {
          success: true,
          message: 'A password reset link has been sent to your email address.',
        },
      });

      render(
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>,
      );

      const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
      await user.type(emailInput, 'user@example.com');

      const submitBtn = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(authService.requestPasswordResetLink).toHaveBeenCalledWith('user@example.com');
        expect(screen.getByText(/password reset link sent/i)).toBeInTheDocument();
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
        expect(screen.getByText(/please open the link from your email to set your new password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /return to sign in/i })).toBeInTheDocument();
      });
    });
  });

  describe('ResetPasswordPage', () => {
    it('displays invalid link warning when token or email are missing from query', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: /invalid reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request new reset link/i })).toBeInTheDocument();
    });

    it('renders password fields when token and email parameters are present', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-tok&email=user@example.com']}>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/re-enter your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save new password/i })).toBeInTheDocument();
    });

    it('submits new password and shows success confirmation', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.resetPassword).mockResolvedValueOnce({
        status: 'success',
        message: 'Password reset successful',
        data: { success: true, message: 'Password reset successful' },
      });

      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-tok&email=user@example.com']}>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      const passInput = screen.getByPlaceholderText(/at least 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);

      await user.type(passInput, 'NewSecretPassword123!');
      await user.type(confirmInput, 'NewSecretPassword123!');

      await user.click(screen.getByRole('button', { name: /save new password/i }));

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith({
          token: 'valid-tok',
          email: 'user@example.com',
          newPassword: 'NewSecretPassword123!',
          confirmPassword: 'NewSecretPassword123!',
        });
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument();
      });
    });
  });
});
