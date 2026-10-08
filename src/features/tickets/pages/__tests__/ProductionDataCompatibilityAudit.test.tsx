import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailsPage } from '../TicketDetailsPage';
import { useTicketStore } from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ticketService } from '../../api/ticket.service';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTicket: vi.fn(),
    getUsersMentionLookup: vi.fn().mockResolvedValue([]),
    uploadAudio: vi.fn().mockResolvedValue({ url: 'https://cloudinary.com/audio.webm' }),
    uploadAttachment: vi.fn().mockImplementation((file: File) => 
      Promise.resolve({
        id: 'att-' + Math.random().toString(36).substring(7),
        fileName: file.name,
        fileUrl: 'https://cloudinary.com/' + file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
      })
    ),
  }
}));

vi.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: (perm: string) => perm === 'tickets:read' || perm === 'tickets:comment',
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

// Mock URL APIs
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
} else {
  vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
} else {
  vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
}

describe('Production-Data Compatibility and Backward Compatibility Audit', () => {
  const mockAddMessage = vi.fn().mockResolvedValue(undefined);
  const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
  const mockEditMessage = vi.fn().mockResolvedValue(undefined);
  const mockDeleteMessage = vi.fn().mockResolvedValue(undefined);

  // Exact reproduction of legacy production data created months before this feature
  const legacyProductionTicket = {
    id: 'prod-ticket-001',
    title: 'Production Database Latency Spike',
    description: 'Postgres query latency increased to 450ms. Investigate https://metrics.internal/db/slow-queries',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    teamId: 'team-infra-01',
    createdById: 'user-lead-1',
    createdBy: { id: 'user-lead-1', name: 'DevOps Lead', email: 'lead@example.com' },
    createdAt: '2026-04-10T08:30:00.000Z',
    updatedAt: '2026-04-10T11:45:00.000Z',
    version: 4,
    assignees: [
      { id: 'assignee-1', user: { id: 'user-current', name: 'Database Admin', email: 'dba@example.com' } }
    ],
    messages: [
      // 1. Legacy text-only message (no audioUrl, no attachments field, or empty attachments)
      {
        id: 'legacy-msg-1',
        ticketId: 'prod-ticket-001',
        userId: 'user-lead-1',
        user: { id: 'user-lead-1', name: 'DevOps Lead', email: 'lead@example.com' },
        content: 'Initial incident opened. Please check https://grafana.internal/d/slow-db and www.postgres-logs.net',
        audioUrl: null,
        attachments: [],
        replyTo: null,
        reactions: [],
        isDeleted: false,
        isEdited: false,
        createdAt: '2026-04-10T08:31:00.000Z',
      },
      // 2. Legacy voice note message from previous release (audioUrl present, attachments is empty array)
      {
        id: 'legacy-msg-2',
        ticketId: 'prod-ticket-001',
        userId: 'user-current',
        user: { id: 'user-current', name: 'Database Admin', email: 'dba@example.com' },
        content: '🎤 Voice Message',
        audioUrl: 'https://cloudinary.com/audio/legacy_voice_1.webm',
        attachments: [],
        replyTo: null,
        reactions: [{ reaction: '👍', user: { id: 'user-lead-1', name: 'DevOps Lead' } }],
        isDeleted: false,
        isEdited: false,
        createdAt: '2026-04-10T08:45:00.000Z',
      },
      // 3. Legacy replied message (replyTo populated with previous message)
      {
        id: 'legacy-msg-3',
        ticketId: 'prod-ticket-001',
        userId: 'user-lead-1',
        user: { id: 'user-lead-1', name: 'DevOps Lead', email: 'lead@example.com' },
        content: 'Acknowledged voice note. Indexes are running now.',
        audioUrl: null,
        attachments: [],
        replyTo: {
          id: 'legacy-msg-2',
          content: '🎤 Voice Message',
          isDeleted: false,
          user: { name: 'Database Admin' }
        },
        reactions: [],
        isDeleted: false,
        isEdited: false,
        createdAt: '2026-04-10T08:50:00.000Z',
      },
      // 4. Legacy edited message (isEdited: true)
      {
        id: 'legacy-msg-4',
        ticketId: 'prod-ticket-001',
        userId: 'user-current',
        user: { id: 'user-current', name: 'Database Admin', email: 'dba@example.com' },
        content: 'Updated connection pool size to 50.',
        audioUrl: null,
        attachments: [],
        replyTo: null,
        reactions: [],
        isDeleted: false,
        isEdited: true,
        createdAt: '2026-04-10T09:00:00.000Z',
      },
      // 5. Legacy deleted message (isDeleted: true)
      {
        id: 'legacy-msg-5',
        ticketId: 'prod-ticket-001',
        userId: 'user-lead-1',
        user: { id: 'user-lead-1', name: 'DevOps Lead', email: 'lead@example.com' },
        content: 'Sensitive connection string removed',
        audioUrl: null,
        attachments: [],
        replyTo: null,
        reactions: [],
        isDeleted: true,
        isEdited: false,
        createdAt: '2026-04-10T09:10:00.000Z',
      },
      // 6. Legacy message with existing attachment (e.g. image attachment from previous version)
      {
        id: 'legacy-msg-6',
        ticketId: 'prod-ticket-001',
        userId: 'user-current',
        user: { id: 'user-current', name: 'Database Admin', email: 'dba@example.com' },
        content: 'Here is the CPU utilization graph',
        audioUrl: null,
        attachments: [
          {
            id: 'legacy-att-1',
            messageId: 'legacy-msg-6',
            fileName: 'cpu_usage.png',
            fileUrl: 'https://cloudinary.com/ticket_attachments/cpu_usage.png',
            fileSize: 1024 * 250,
            fileType: 'image/png',
            createdAt: '2026-04-10T09:20:00.000Z',
          }
        ],
        replyTo: null,
        reactions: [],
        isDeleted: false,
        isEdited: false,
        createdAt: '2026-04-10T09:20:00.000Z',
      }
    ],
  };

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
        id: 'user-current',
        email: 'dba@example.com',
        name: 'Database Admin',
      } as any,
      isAuthenticated: true,
      accessToken: 'test-token',
    });

    useTicketStore.setState({
      currentTicket: legacyProductionTicket as any,
      loading: false,
      error: null,
      fetchTicket: vi.fn().mockResolvedValue(undefined),
      updateStatus: mockUpdateStatus,
      addMessage: mockAddMessage,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
      handleNewMessage: vi.fn(),
      handleReactionUpdated: vi.fn(),
    } as any);
  });

  it('correctly loads and displays all legacy production messages without throwing errors', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/prod-ticket-001']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // 1. Text message with links is rendered and links are clickable
    const linkGrafana = await screen.findByRole('link', { name: 'https://grafana.internal/d/slow-db' });
    expect(linkGrafana).toBeInTheDocument();
    expect(linkGrafana).toHaveAttribute('href', 'https://grafana.internal/d/slow-db');

    const linkLogs = screen.getByRole('link', { name: 'www.postgres-logs.net' });
    expect(linkLogs).toBeInTheDocument();
    expect(linkLogs).toHaveAttribute('href', 'https://www.postgres-logs.net');

    // 2. Legacy voice note rendered with voice player (and also in quoted reply)
    expect(screen.getAllByText('🎤 Voice Message').length).toBeGreaterThan(0);

    // 3. Legacy reply quote header rendered
    expect(screen.getByText(/Acknowledged voice note/i)).toBeInTheDocument();

    // 4. Legacy edited indicator rendered
    expect(screen.getByText(/Updated connection pool size to 50/i)).toBeInTheDocument();
    expect(screen.getAllByText('edited').length).toBeGreaterThan(0);

    // 5. Legacy deleted tombstone rendered
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();

    // 6. Legacy attachment (image) rendered
    expect(screen.getByText('Here is the CPU utilization graph')).toBeInTheDocument();
    const imageEl = screen.getByAltText('cpu_usage.png');
    expect(imageEl).toBeInTheDocument();
  });

  it('preserves legacy send behavior: sending plain text with no attachments or audio calls addMessage normally', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/prod-ticket-001']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await screen.findByPlaceholderText(/Type a message or @name to mention\/assign\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'Standard legacy text comment' } });

    const sendBtn = screen.getByTitle('Send message (Enter)');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalledWith(
        'prod-ticket-001',
        'Standard legacy text comment',
        undefined,
        undefined,
        undefined,
        []
      );
    });
  });

  it('handles empty ticket messages gracefully when tickets have no messages yet', async () => {
    useTicketStore.setState({
      currentTicket: {
        ...legacyProductionTicket,
        messages: [],
      } as any,
    });

    render(
      <MemoryRouter initialEntries={['/tickets/prod-ticket-001']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No messages here yet\. Send a message to start the conversation!/i)).toBeInTheDocument();
    });
  });

  it('disables message composer when legacy ticket status is CLOSED', async () => {
    useTicketStore.setState({
      currentTicket: {
        ...legacyProductionTicket,
        status: 'CLOSED',
      } as any,
    });

    render(
      <MemoryRouter initialEntries={['/tickets/prod-ticket-001']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // The composer is hidden when ticket is closed
      expect(screen.queryByPlaceholderText(/Type a message or @name to mention\/assign\.\.\./i)).not.toBeInTheDocument();
    });
  });
});
