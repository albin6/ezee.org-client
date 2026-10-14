import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailsPage } from '../TicketDetailsPage';
import { useTicketStore } from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ticketService, type MentionUser } from '../../api/ticket.service';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTicket: vi.fn(),
    getUsersMentionLookup: vi.fn(),
    uploadAudio: vi.fn(),
    uploadAttachment: vi.fn(),
    getMessageReactions: vi.fn().mockResolvedValue([]),
  },
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
  },
}));

describe('Ticket User Mentions & Assignee Separation', () => {
  const mockAddAssignee = vi.fn().mockResolvedValue({ id: 'ticket-1' });
  const mockAddMessage = vi.fn().mockResolvedValue(undefined);

  const mockUsers: MentionUser[] = [
    {
      id: 'creator-1',
      name: 'Alice Creator',
      email: 'alice@example.com',
      teamId: 'team-1',
      teamName: 'Core Engineering',
      designation: 'Tech Lead',
    },
    {
      id: 'assignee-1',
      name: 'Bob Assignee',
      email: 'bob@example.com',
      teamId: 'team-1',
      teamName: 'Core Engineering',
      designation: 'Backend Dev',
    },
    {
      id: 'external-user-1',
      name: 'Charlie External',
      email: 'charlie@example.com',
      teamId: 'team-2',
      teamName: 'DevOps',
      designation: 'SRE',
    },
  ];

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

    vi.mocked(ticketService.getUsersMentionLookup).mockResolvedValue(mockUsers);

    useAuthStore.setState({
      user: {
        type: 'user',
        id: 'creator-1',
        email: 'alice@example.com',
        name: 'Alice Creator',
      } as any,
      isAuthenticated: true,
      accessToken: 'test-token',
    });

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Improve Latency in Tickets',
        description: 'Optimize queries and add cache',
        status: 'OPEN',
        priority: 'HIGH',
        createdById: 'creator-1',
        createdBy: { id: 'creator-1', name: 'Alice Creator', email: 'alice@example.com' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        assignees: [
          {
            userId: 'assignee-1',
            user: { id: 'assignee-1', name: 'Bob Assignee', email: 'bob@example.com' },
          },
        ],
        messages: [
          {
            id: 'msg-1',
            content: 'Hello @Bob Assignee please review this task',
            mentions: [{ userId: 'assignee-1', name: 'Bob Assignee' }],
            createdAt: new Date().toISOString(),
            isSystem: false,
            user: { id: 'creator-1', name: 'Alice Creator' },
          },
        ],
      } as any,
      loading: false,
      error: null,
      fetchTicket: vi.fn().mockResolvedValue(undefined),
      addAssignee: mockAddAssignee,
      addMessage: mockAddMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
      handleNewMessage: vi.fn(),
      handleReactionUpdated: vi.fn(),
    } as any);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders existing messages with WhatsApp light green highlight for mentions', () => {
    const { container } = renderComponent();

    const mentionPill = container.querySelector('[data-testid="message-mention"]');
    expect(mentionPill).toBeInTheDocument();
    expect(mentionPill?.textContent).toBe('@Bob Assignee');
    // WhatsApp light green styling
    expect(mentionPill?.className).toContain('text-[#075e54]');
    expect(mentionPill?.className).toContain('bg-[#cbf3b6]'); // isMe = true for creator-1
  });

  it('displays user suggestions when typing @ and marks participants with Mention tag and non-participants with Add assignee tag', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Type a message or @name to mention\/assign/i);
    fireEvent.change(textarea, { target: { value: '@' } });

    await waitFor(() => {
      const dropdown = screen.getByTestId('mention-autocomplete-dropdown');
      expect(dropdown).toBeInTheDocument();
      expect(within(dropdown).getByText('Alice Creator')).toBeInTheDocument();
      expect(within(dropdown).getByText('Bob Assignee')).toBeInTheDocument();
      expect(within(dropdown).getByText('Charlie External')).toBeInTheDocument();
    });

    const dropdown = screen.getByTestId('mention-autocomplete-dropdown');
    // Check tags: Bob Assignee is a participant (Mention tag), Charlie is non-participant (Add assignee tag)
    const mentionTags = within(dropdown).getAllByText('Mention');
    expect(mentionTags.length).toBeGreaterThan(0);

    const addAssigneeTags = within(dropdown).getAllByText(/Add assignee/i);
    expect(addAssigneeTags.length).toBeGreaterThan(0);
  });

  it('selecting a participant populates the input with @Name and does not execute addAssignee prematurely', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Type a message or @name to mention\/assign/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '@Bob' } });

    await waitFor(() => {
      const dropdown = screen.getByTestId('mention-autocomplete-dropdown');
      expect(within(dropdown).getByText('Bob Assignee')).toBeInTheDocument();
    });

    const dropdown = screen.getByTestId('mention-autocomplete-dropdown');
    fireEvent.click(within(dropdown).getByText('Bob Assignee'));

    // Input should contain @Bob Assignee
    expect(textarea.value).toBe('@Bob Assignee ');
    // addAssignee must NOT be called upon dropdown selection!
    expect(mockAddAssignee).not.toHaveBeenCalled();

    // User can continue typing their message
    fireEvent.change(textarea, { target: { value: '@Bob Assignee please take a look' } });

    // Click Send button
    const sendButton = screen.getByTitle(/Send message \(Enter\)/i);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalledWith(
        'ticket-1',
        '@Bob Assignee please take a look',
        undefined,
        undefined,
        undefined,
        [],
        [{ userId: 'assignee-1', name: 'Bob Assignee' }]
      );
    });

    // Assignees on the ticket remained completely untouched
    expect(mockAddAssignee).not.toHaveBeenCalled();
  });

  it('selecting a non-participant populates the input and only calls addAssignee upon message submission', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Type a message or @name to mention\/assign/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '@Charlie' } });

    await waitFor(() => {
      const dropdown = screen.getByTestId('mention-autocomplete-dropdown');
      expect(within(dropdown).getByText('Charlie External')).toBeInTheDocument();
    });

    const dropdown = screen.getByTestId('mention-autocomplete-dropdown');
    fireEvent.click(within(dropdown).getByText('Charlie External'));

    // Input populated
    expect(textarea.value).toBe('@Charlie External ');
    // Not assigned yet!
    expect(mockAddAssignee).not.toHaveBeenCalled();

    // Explicitly submit message / command
    const sendButton = screen.getByTitle(/Send message \(Enter\)/i);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockAddAssignee).toHaveBeenCalledWith('ticket-1', 'external-user-1');
    });
  });
});
