import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VersionUpdatePrompt } from '../VersionUpdatePrompt';
import { useVersionStore } from '../../stores/version.store';

describe('VersionUpdatePrompt Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    useVersionStore.setState({
      currentVersion: 'v1.0.0',
      latestVersion: null,
      hasUpdate: false,
      isUpdating: false,
      lastCheckedAt: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when hasUpdate is false', () => {
    render(<VersionUpdatePrompt />);
    expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();
  });

  it('renders the update alert when hasUpdate is true', () => {
    useVersionStore.setState({
      hasUpdate: true,
      latestVersion: 'v1.1.0',
    });

    render(<VersionUpdatePrompt />);
    expect(screen.getByText(/new version available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^apply application update$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/dismiss notification/i)).toBeInTheDocument();
  });

  it('calls applyUpdate when the Update button is clicked', async () => {
    const applyUpdateMock = vi.fn().mockResolvedValue(undefined);
    useVersionStore.setState({
      hasUpdate: true,
      latestVersion: 'v1.1.0',
      applyUpdate: applyUpdateMock,
    });

    render(<VersionUpdatePrompt />);
    const updateButton = screen.getByRole('button', { name: /^apply application update$/i });

    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(applyUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('dismisses the notification when the close button is clicked', () => {
    useVersionStore.setState({
      hasUpdate: true,
      latestVersion: 'v1.1.0',
    });

    render(<VersionUpdatePrompt />);
    const dismissButton = screen.getByLabelText(/dismiss notification/i);

    act(() => {
      fireEvent.click(dismissButton);
    });

    const state = useVersionStore.getState();
    expect(state.hasUpdate).toBe(false);
  });

  it('detects a new version on checkForUpdates and checks dismissal', async () => {
    const mockVersionData = { version: 'v2.0.0', buildTime: '2026-10-06T12:00:00Z' };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVersionData,
    } as unknown as Response);

    const store = useVersionStore.getState();
    await act(async () => {
      await store.checkForUpdates(true);
    });

    expect(useVersionStore.getState().hasUpdate).toBe(true);
    expect(useVersionStore.getState().latestVersion).toBe('v2.0.0');

    // Dismiss update
    act(() => {
      useVersionStore.getState().dismissUpdate();
    });
    expect(useVersionStore.getState().hasUpdate).toBe(false);

    // Subsequent check for same version should respect dismissal
    await act(async () => {
      await store.checkForUpdates(true);
    });
    expect(useVersionStore.getState().hasUpdate).toBe(false);
  });
});
