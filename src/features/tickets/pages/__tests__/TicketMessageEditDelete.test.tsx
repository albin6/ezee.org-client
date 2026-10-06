import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailsPage } from '../TicketDetailsPage';
import { useTicketStore } from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTicket: vi.fn(),
    getUsersMentionLookup: vi.fn().mockResolvedValue([]),
    uploadAudio: vi.fn(),
    uploadAttachment: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
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
    getSocket: vi.fn().mockReturnValue(null),
  }
}));

describe('TicketDetailsPage - Message Edit and Delete', () => {
  const mockEditMessage = vi.fn().mockResolvedValue({ id: 'msg-1', content: 'Updated content', isEdited: true });
  const mockDeleteMessage = vi.fn().mockResolvedValue({ status: 'success' });

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
        id: 'user-me',
        email: 'me@example.com',
        name: 'My User',
      } as any,
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  it('renders Edit and Delete buttons for the sender message within 7 minutes', async () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-1',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'Hello, this is my message',
            createdAt: recentDate,
            isDeleted: false,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Hello, this is my message')).toBeInTheDocument();
    expect(screen.getByTitle('Edit message')).toBeInTheDocument();
    expect(screen.getByTitle('Delete message')).toBeInTheDocument();
  });

  it('does NOT render Edit and Delete buttons for messages older than 7 minutes', async () => {
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-old',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'Old message',
            createdAt: oldDate,
            isDeleted: false,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Old message')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit message')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete message')).not.toBeInTheDocument();
  });

  it('does NOT render Edit and Delete buttons for another user message', async () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'other-user',
        createdBy: { id: 'other-user', name: 'Other User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-other',
            ticketId: 'ticket-1',
            userId: 'other-user',
            user: { id: 'other-user', name: 'Other User' },
            content: 'Message from someone else',
            createdAt: recentDate,
            isDeleted: false,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Message from someone else')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit message')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete message')).not.toBeInTheDocument();
  });

  it('does NOT render Edit and Delete buttons if ticket is CLOSED', async () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'CLOSED',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-closed',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'Message in closed ticket',
            createdAt: recentDate,
            isDeleted: false,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Message in closed ticket')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit message')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete message')).not.toBeInTheDocument();
  });

  it('allows user to edit a message within 7 minutes and submit changes', async () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-edit',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'Original message content',
            createdAt: recentDate,
            isDeleted: false,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click edit button
    const editBtn = screen.getByTitle('Edit message');
    fireEvent.click(editBtn);

    // An inline textarea should appear populated with 'Original message content'
    const editTextarea = screen.getByDisplayValue('Original message content') as HTMLTextAreaElement;
    expect(editTextarea).toBeInTheDocument();

    // Modify content
    fireEvent.change(editTextarea, { target: { value: 'Corrected message content' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockEditMessage).toHaveBeenCalledWith('ticket-1', 'msg-edit', 'Corrected message content');
    });
  });

  it('displays "(edited)" indicator when message has isEdited: true', async () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-edited',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'I have been edited',
            createdAt: recentDate,
            isDeleted: false,
            isEdited: true,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('edited')).toBeInTheDocument();
  });

  it('renders tombstone when isDeleted: true and hides action buttons', async () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-deleted',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'This message was deleted',
            createdAt: recentDate,
            isDeleted: true,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit message')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete message')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reply')).not.toBeInTheDocument();
  });

  it('opens delete modal and allows Delete for Everyone and Delete for Me', async () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-1',
        title: 'Network Issue',
        status: 'OPEN',
        createdById: 'user-me',
        createdBy: { id: 'user-me', name: 'My User' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-del',
            ticketId: 'ticket-1',
            userId: 'user-me',
            user: { id: 'user-me', name: 'My User' },
            content: 'To be deleted',
            createdAt: recentDate,
            isDeleted: false,
            isEdited: false,
          }
        ],
      } as any,
      loading: false,
      editMessage: mockEditMessage,
      deleteMessage: mockDeleteMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click delete button
    const deleteBtn = screen.getByTitle('Delete message');
    fireEvent.click(deleteBtn);

    // Modal options appear
    const deleteEveryoneBtn = screen.getByRole('button', { name: /Delete for Everyone/i });
    const deleteMeBtn = screen.getByRole('button', { name: /Delete for Me/i });
    expect(deleteEveryoneBtn).toBeInTheDocument();
    expect(deleteMeBtn).toBeInTheDocument();

    // Click Delete for Everyone
    fireEvent.click(deleteEveryoneBtn);

    await waitFor(() => {
      expect(mockDeleteMessage).toHaveBeenCalledWith('ticket-1', 'msg-del', 'everyone');
    });
  });
});
