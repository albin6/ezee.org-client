import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailsPage } from '../TicketDetailsPage';
import { useTicketStore } from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Modal } from 'antd';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTicket: vi.fn(),
    getUsersMentionLookup: vi.fn().mockResolvedValue([]),
    uploadAudio: vi.fn(),
    uploadAttachment: vi.fn(),
  }
}));

vi.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock('@/shared/services/socket.service', () => ({
  socketService: {
    connect: vi.fn().mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    }),
  }
}));

describe('TicketDetailsPage - Closing Ticket Confirmation', () => {
  const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
  const mockAddMessage = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });

    Element.prototype.scrollIntoView = vi.fn();

    vi.clearAllMocks();

    useAuthStore.setState({
      user: {
        type: 'user',
        id: 'creator-user-id',
        email: 'creator@example.com',
        name: 'Creator User',
      } as any,
      isAuthenticated: true,
      accessToken: 'test-token',
    });

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-res-1',
        title: 'Resolved Database Latency',
        description: 'Fixed slow queries',
        status: 'OPEN',
        priority: 'MEDIUM',
        createdById: 'creator-user-id',
        createdBy: { id: 'creator-user-id', name: 'Creator User', email: 'creator@example.com' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        assignees: [],
        messages: [],
      } as any,
      loading: false,
      error: null,
      fetchTicket: vi.fn().mockResolvedValue(undefined),
      updateStatus: mockUpdateStatus,
      addMessage: mockAddMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
      handleNewMessage: vi.fn(),
      handleReactionUpdated: vi.fn(),
    } as any);
  });

  it('triggers only a single confirmation modal when Close Permanently is clicked', async () => {
    useTicketStore.setState({
      currentTicket: {
        ...useTicketStore.getState().currentTicket,
        status: 'RESOLVED',
      } as any,
    });

    const modalConfirmSpy = vi.spyOn(Modal, 'confirm');

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-res-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the resolved ticket banner to appear
    await waitFor(() => {
      expect(screen.getByText(/This ticket has been marked as Resolved\./i)).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /Close Permanently/i });
    expect(closeBtn).toBeInTheDocument();

    // Click Close Permanently
    fireEvent.click(closeBtn);

    // Modal.confirm must be called exactly ONCE (no Popconfirm duplicate)
    expect(modalConfirmSpy).toHaveBeenCalledTimes(1);
    expect(modalConfirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Close Ticket Permanently?',
        content: 'Are you sure you want to close this ticket permanently? It cannot be reopened.',
        okText: 'Yes, Close',
      })
    );
  });

  it('renders message textarea with 24px initial height and automatically focuses it', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-res-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await screen.findByPlaceholderText(/Type a message or @name to mention\/assign\.\.\./i) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.rows).toBe(1);
    expect(textarea.className).toContain('h-[24px]');
    expect(textarea.className).toContain('min-h-[24px]');
    expect(textarea.style.height).toBe('24px');
    expect(textarea.style.minHeight).toBe('24px');

    // Auto-focus check
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
    });
  });

  it('refocuses the message textarea after sending a message', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-res-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await screen.findByPlaceholderText(/Type a message or @name to mention\/assign\.\.\./i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Working on this issue now' } });

    // Send button appears when message is typed
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeInTheDocument();
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalledWith(
        'ticket-res-1',
        'Working on this issue now',
        undefined,
        undefined,
        undefined,
        []
      );
    });

    // Auto-refocus check after send
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
    });
  });

  it('manages voice recording buttons across idle, recording, and paused states', async () => {
    const mockTracks = [{ stop: vi.fn() }];
    const mockStream = { getTracks: () => mockTracks };
    class MockMediaRecorder {
      state = 'inactive';
      start = vi.fn().mockImplementation(() => { this.state = 'recording'; });
      pause = vi.fn().mockImplementation(() => { this.state = 'paused'; });
      resume = vi.fn().mockImplementation(() => { this.state = 'recording'; });
      stop = vi.fn().mockImplementation(() => { 
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      });
      mimeType = 'audio/webm';
      stream = mockStream;
      onstop: any = null;
      ondataavailable: any = null;
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });
    window.MediaRecorder = MockMediaRecorder as any;

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-res-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // 1. Idle state: mic button is rendered
    const micButton = await screen.findByTitle(/Record voice message/i);
    expect(micButton).toBeInTheDocument();

    // 2. Click mic to start recording
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText(/Recording\.\.\./i)).toBeInTheDocument();
    });

    // Same button transforms into Send button
    expect(screen.getByTitle(/Stop recording and send voice message/i)).toBeInTheDocument();

    // Pause button and Stop/Cancel button are rendered
    const pauseButton = screen.getByTitle(/Pause recording/i);
    const stopButton = screen.getByTitle(/Stop & cancel recording \(discard\)/i);
    expect(pauseButton).toBeInTheDocument();
    expect(stopButton).toBeInTheDocument();

    // 3. Click Pause button: transitions to Paused state
    fireEvent.click(pauseButton);
    await waitFor(() => {
      expect(screen.getByText(/Paused/i)).toBeInTheDocument();
    });
    const resumeButton = screen.getByTitle(/Resume recording/i);
    expect(resumeButton).toBeInTheDocument();

    // 4. Click Resume button: transitions back to Recording state
    fireEvent.click(resumeButton);
    await waitFor(() => {
      expect(screen.getByText(/Recording\.\.\./i)).toBeInTheDocument();
    });

    // 5. Click Stop/Cancel button: stops recording and discards without sending
    fireEvent.click(stopButton);
    await waitFor(() => {
      expect(screen.getByTitle(/Record voice message/i)).toBeInTheDocument();
      expect(screen.queryByText(/Recording\.\.\./i)).not.toBeInTheDocument();
    });
  });
});
