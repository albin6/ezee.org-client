import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PWAInstallPrompt } from '../PWAInstallPrompt';
import { usePWAStore } from '../../stores/pwa.store';

interface MockBeforeInstallPromptEvent extends Event {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

const createMockInstallEvent = (outcome: 'accepted' | 'dismissed' = 'accepted'): MockBeforeInstallPromptEvent => {
  const event = new Event('beforeinstallprompt') as MockBeforeInstallPromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return event;
};

describe('PWAInstallPrompt Component', () => {
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();

    usePWAStore.setState({
      deferredPrompt: null,
      isStandalone: false,
      showPrompt: false,
      isIOS: false,
      canInstall: false,
    });

    // Default: not standalone
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('does not render when app is running in standalone mode', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('standalone'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    usePWAStore.setState({ isStandalone: true });

    render(<PWAInstallPrompt />);

    const prompt = screen.queryByRole('region', { name: /install application prompt/i });
    expect(prompt).not.toBeInTheDocument();
  });

  it('does not render when dismissed within the last 24 hours', () => {
    // Dismissed 2 hours ago
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    localStorage.setItem('pwa_prompt_dismissed_at', twoHoursAgo.toString());

    render(<PWAInstallPrompt />);

    const event = createMockInstallEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });

    const prompt = screen.queryByRole('region', { name: /install application prompt/i });
    expect(prompt).not.toBeInTheDocument();
  });

  it('renders Android / Desktop install prompt when beforeinstallprompt fires', () => {
    render(<PWAInstallPrompt />);

    const event = createMockInstallEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });

    expect(screen.getByRole('region', { name: /install application prompt/i })).toBeInTheDocument();
    expect(screen.getByText(/install ezee/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss install prompt/i })).toBeInTheDocument();
  });

  it('triggers install flow and dismisses when user accepts', async () => {
    render(<PWAInstallPrompt />);

    const event = createMockInstallEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });

    const installBtn = screen.getByRole('button', { name: /install app/i });
    await act(async () => {
      fireEvent.click(installBtn);
    });

    expect(event.prompt).toHaveBeenCalled();

    // Fast-forward exit animation
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByRole('region', { name: /install application prompt/i })).not.toBeInTheDocument();
  });

  it('dismisses prompt and persists dismissal timestamp when clicking Not now', () => {
    render(<PWAInstallPrompt />);

    const event = createMockInstallEvent('dismissed');
    act(() => {
      window.dispatchEvent(event);
    });

    const notNowBtn = screen.getByRole('button', { name: /not now/i });
    act(() => {
      fireEvent.click(notNowBtn);
    });

    // Animate out
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByRole('region', { name: /install application prompt/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa_prompt_dismissed_at')).toBeTruthy();
  });

  it('dismisses prompt when clicking the close (X) button', () => {
    render(<PWAInstallPrompt />);

    const event = createMockInstallEvent('dismissed');
    act(() => {
      window.dispatchEvent(event);
    });

    const closeBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByRole('region', { name: /install application prompt/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa_prompt_dismissed_at')).toBeTruthy();
  });

  it('dismisses prompt when pressing the Escape key', () => {
    render(<PWAInstallPrompt />);

    const event = createMockInstallEvent('dismissed');
    act(() => {
      window.dispatchEvent(event);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByRole('region', { name: /install application prompt/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa_prompt_dismissed_at')).toBeTruthy();
  });

  it('renders iOS Safari prompt when user-agent is iPhone and shows instructions', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    usePWAStore.setState({ isIOS: true });

    render(<PWAInstallPrompt />);

    expect(screen.getByRole('region', { name: /install application prompt/i })).toBeInTheDocument();
    expect(screen.getByText(/add to home screen on ios/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. tap the share button/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. select "add to home screen"/i)).toBeInTheDocument();

    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    expect(gotItBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(gotItBtn);
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByRole('region', { name: /install application prompt/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa_prompt_dismissed_at')).toBeTruthy();
  });

  it('can be reopened on-demand via usePWAStore openPrompt even if previously dismissed', () => {
    // Simulate user previously clicked 'Not now'
    localStorage.setItem('pwa_prompt_dismissed_at', Date.now().toString());

    render(<PWAInstallPrompt />);

    // Capture event
    const event = createMockInstallEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });

    // Should initially be hidden due to 24-hour dismissal
    expect(screen.queryByRole('region', { name: /install application prompt/i })).not.toBeInTheDocument();

    // Now user clicks 'Install App' in Profile or User Menu
    act(() => {
      usePWAStore.getState().openPrompt();
    });

    expect(screen.getByRole('region', { name: /install application prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
  });
});
