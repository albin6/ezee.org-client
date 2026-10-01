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
        status: 'RESOLVED',
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
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
      handleNewMessage: vi.fn(),
      handleReactionUpdated: vi.fn(),
    } as any);
  });

  it('triggers only a single confirmation modal when Close Permanently is clicked', async () => {
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
});
