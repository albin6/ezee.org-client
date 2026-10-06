import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '../ProfilePage';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { usePWAStore } from '@/shared/stores/pwa.store';

vi.mock('../../services/auth.service', () => ({
  authService: {
    getUserProfile: vi.fn(),
    getProfile: vi.fn(),
    verifyCurrentPassword: vi.fn(),
    changePassword: vi.fn(),
  },
}));

describe('ProfilePage - Reset Password Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-123',
        email: 'alex@example.com',
        name: 'Alex Johnson',
        type: 'user',
        status: 'ACTIVE',
      } as any,
      accessToken: 'mock-token',
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserProfile).mockResolvedValue({
      status: 'success',
      message: 'Profile retrieved successfully',
      data: {
        id: 'user-123',
        email: 'alex@example.com',
        name: 'Alex Johnson',
        type: 'user',
        status: 'ACTIVE',
      },
    } as any);
  });

  it('renders profile details and initial current password field', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      expect(screen.getByText('alex@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your current password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verify current password/i })).toBeInTheDocument();
    });
  });

  it('verifies current password and unlocks new password and confirm password fields', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.verifyCurrentPassword).mockResolvedValueOnce({
      status: 'success',
      message: 'Current password verified successfully.',
      data: { valid: true, message: 'Current password verified successfully.' },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter your current password/i)).toBeInTheDocument();
    });

    const currentPassInput = screen.getByPlaceholderText(/enter your current password/i);
    await user.type(currentPassInput, 'CurrentSecret123!');

    const verifyBtn = screen.getByRole('button', { name: /verify current password/i });
    await user.click(verifyBtn);

    await waitFor(() => {
      expect(authService.verifyCurrentPassword).toHaveBeenCalledWith('CurrentSecret123!');
      expect(screen.getByText(/current password verified successfully/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/confirm your new password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument();
    });
  });

  it('submits new password and confirm password and calls changePassword API with current and new passwords', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.verifyCurrentPassword).mockResolvedValueOnce({
      status: 'success',
      message: 'Current password verified successfully.',
      data: { valid: true, message: 'Current password verified successfully.' },
    });
    vi.mocked(authService.changePassword).mockResolvedValueOnce({
      status: 'success',
      message: 'Password changed successfully.',
      data: { success: true, message: 'Password changed successfully.' },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter your current password/i)).toBeInTheDocument();
    });

    // Step 1: Verify current password
    const currentPassInput = screen.getByPlaceholderText(/enter your current password/i);
    await user.type(currentPassInput, 'CurrentSecret123!');
    await user.click(screen.getByRole('button', { name: /verify current password/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
    });

    // Step 2: Enter new password and confirm password
    const newPassInput = screen.getByPlaceholderText(/enter new password/i);
    const confirmPassInput = screen.getByPlaceholderText(/confirm your new password/i);

    await user.type(newPassInput, 'BrandNewPassword456!');
    await user.type(confirmPassInput, 'BrandNewPassword456!');

    const setPassBtn = screen.getByRole('button', { name: /set new password/i });
    await user.click(setPassBtn);

    await waitFor(() => {
      expect(authService.changePassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentSecret123!',
        newPassword: 'BrandNewPassword456!',
        confirmPassword: 'BrandNewPassword456!',
      });
      // Should reset back to Step 1
      expect(screen.getByPlaceholderText(/enter your current password/i)).toBeInTheDocument();
    });
  });

  it('renders Application & Device section with Install App button when not in standalone mode', async () => {
    const mockPromptInstall = vi.fn();
    usePWAStore.setState({
      isStandalone: false,
      promptInstall: mockPromptInstall,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Application & Device')).toBeInTheDocument();
      expect(screen.getByText('Web Browser')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
    });

    const installBtn = screen.getByRole('button', { name: /install app/i });
    await userEvent.click(installBtn);

    expect(mockPromptInstall).toHaveBeenCalled();
  });

  it('renders Installed tag and hides Install App button when app is running in standalone mode', async () => {
    usePWAStore.setState({
      isStandalone: true,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Application & Device')).toBeInTheDocument();
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();
    });
  });
});
