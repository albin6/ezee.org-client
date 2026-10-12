import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../TicketListPage';
import {
  useTicketStore,
  isTicketUnreadForUser,
  isTicketNewlyAssignedForUser,
  sortTicketsList,
} from '../../store/ticket.store';
import { useUserStore } from '@/features/users/store/user.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ticketService } from '../../api/ticket.service';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTickets: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getTicket: vi.fn(),
    markTicketAsRead: vi.fn().mockResolvedValue({ status: 'success' }),
    getMyGroupMembers: vi.fn().mockResolvedValue([]),
    getHolidays: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/features/teams/api/team.service', () => ({
  teamService: {
    getTeams: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
  }),
}));

describe('TicketListPage - Newly Assigned & Unread Tickets Enhancement', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([]);

    useAuthStore.setState({
      user: { id: 'user-logged-in', name: 'Logged In User', role: { name: 'Developer' } } as any,
    });

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

    useUserStore.setState({
      users: [],
      loading: false,
      fetchUsers: vi.fn().mockResolvedValue([]),
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. renders the Unread filter button alongside My Tickets and fetches with unread: true when clicked', async () => {
    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      tickets: [],
      total: 0,
      loading: false,
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>
    );

    const unreadBtn = screen.getByTestId('unread-tickets-filter-btn');
    expect(unreadBtn).toBeInTheDocument();
    expect(unreadBtn).toHaveTextContent('Unread');

    fireEvent.click(unreadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('unread-tickets-filter-btn')).toHaveTextContent('Unread ✓');
      expect(screen.getByText('Viewing: Unread Tickets')).toBeInTheDocument();
      expect(fetchTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          unread: true,
          myTickets: false,
          myGroup: false,
        })
      );
    });
  });

  it('2 & 3. displays the "New" tag and promotes a newly assigned unread LOW-priority ticket above a CRITICAL read ticket during the 30-minute window', async () => {
    const now = Date.now();
    const fiveMinsAgoIso = new Date(now - 5 * 60 * 1000).toISOString();
    const twoHoursAgoIso = new Date(now - 120 * 60 * 1000).toISOString();

    const criticalExistingTicket: any = {
      id: 't-critical-existing',
      title: 'Critical Existing Server Ticket',
      description: 'High severity production ticket',
      status: 'OPEN',
      priority: 'CRITICAL',
      teamId: 'team-1',
      createdById: 'u-admin',
      createdAt: twoHoursAgoIso,
      updatedAt: twoHoursAgoIso,
      version: 1,
      assignees: [
        {
          userId: 'user-logged-in',
          createdAt: twoHoursAgoIso,
          readAt: twoHoursAgoIso,
          user: { id: 'user-logged-in', name: 'Logged In User', email: 'me@example.com' },
        },
      ],
    };

    const newlyAssignedLowTicket: any = {
      id: 't-newly-assigned-low',
      title: 'Newly Assigned Low Priority Ticket',
      description: 'Assigned 5 minutes ago and unread',
      status: 'OPEN',
      priority: 'LOW',
      teamId: 'team-1',
      createdById: 'u-admin',
      createdAt: twoHoursAgoIso, // Ticket created 2 hours ago, but assigned 5 mins ago!
      updatedAt: fiveMinsAgoIso,
      version: 2,
      assignees: [
        {
          userId: 'user-logged-in',
          createdAt: fiveMinsAgoIso, // Assignment timestamp is 5 mins ago
          readAt: null,
          user: { id: 'user-logged-in', name: 'Logged In User', email: 'me@example.com' },
        },
      ],
    };

    useTicketStore.setState({
      tickets: [criticalExistingTicket, newlyAssignedLowTicket],
      total: 2,
      loading: false,
      fetchTickets: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>
    );

    // Verify "New" tag is shown ONLY on the newly assigned unread ticket
    expect(screen.getByTestId('new-unread-tag-t-newly-assigned-low')).toBeInTheDocument();
    expect(screen.queryByTestId('new-unread-tag-t-critical-existing')).not.toBeInTheDocument();

    // Verify the LOW priority newly assigned ticket is promoted to the very top (index 0) ahead of CRITICAL
    const cards = screen.getAllByTestId(/^ticket-card-/);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute('data-testid', 'ticket-card-t-newly-assigned-low');
    expect(cards[1]).toHaveAttribute('data-testid', 'ticket-card-t-critical-existing');

    // Verify the stored priority displayed on the card is still LOW (not mutated)
    expect(cards[0]).toHaveTextContent('LOW');
  });

  it('4. opening ticket details (fetchTicket) marks the ticket as read for the logged-in user, removes the New tag, and removes it from the Unread filter view', async () => {
    const fiveMinsAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const readNowIso = new Date().toISOString();

    const unreadTicket: any = {
      id: 't-open-to-read',
      title: 'Unread Ticket To Open',
      description: 'Should become read when details page fetches it',
      status: 'OPEN',
      priority: 'LOW',
      teamId: 'team-1',
      createdById: 'u-admin',
      createdAt: fiveMinsAgoIso,
      updatedAt: fiveMinsAgoIso,
      version: 1,
      assignees: [
        {
          userId: 'user-logged-in',
          createdAt: fiveMinsAgoIso,
          readAt: null,
          user: { id: 'user-logged-in', name: 'Logged In User', email: 'me@example.com' },
        },
      ],
    };

    // Simulate backend GET /tickets/:id returning the ticket with readAt populated
    vi.mocked(ticketService.getTicket).mockResolvedValue({
      status: 'success',
      data: {
        ...unreadTicket,
        assignees: [
          {
            ...unreadTicket.assignees[0],
            readAt: readNowIso,
          },
        ],
      },
    });

    useTicketStore.setState({
      tickets: [unreadTicket],
      total: 1,
      loading: false,
      activeListParams: {
        page: 1,
        limit: 12,
        status: 'OPEN,IN_PROGRESS',
        sortBy: 'priority',
        sortOrder: 'desc',
        myTickets: false,
        myGroup: false,
        unread: true,
      },
    });

    expect(isTicketUnreadForUser(useTicketStore.getState().tickets[0], 'user-logged-in')).toBe(true);

    // User opens TicketDetailsPage which calls fetchTicket('t-open-to-read')
    await act(async () => {
      await useTicketStore.getState().fetchTicket('t-open-to-read');
    });

    const updatedTicketInStore = useTicketStore.getState().tickets[0];
    expect(isTicketUnreadForUser(updatedTicketInStore, 'user-logged-in')).toBe(false);
    expect(isTicketNewlyAssignedForUser(updatedTicketInStore, 'user-logged-in')).toBe(false);

    // Also when TICKET_UPDATED arrives in Unread view, it removes the read ticket from the Unread list
    act(() => {
      useTicketStore
        .getState()
        .handleTicketUpdatedRealtime(updatedTicketInStore, 'user-logged-in');
    });

    expect(useTicketStore.getState().tickets).toHaveLength(0);
  });

  it('5 & 6. automatically removes the "New" tag and returns the ticket to its normal priority position after 30 minutes from assignment', async () => {
    vi.useFakeTimers();
    const baseTime = new Date('2026-10-12T10:00:00.000Z').getTime();
    vi.setSystemTime(baseTime);

    // Assigned 29 minutes ago (1 minute remaining in the 30-minute window)
    const assigned29MinsAgoIso = new Date(baseTime - 29 * 60 * 1000).toISOString();
    const twoHoursAgoIso = new Date(baseTime - 120 * 60 * 1000).toISOString();

    const highPriorityTicket: any = {
      id: 't-high-normal',
      title: 'High Priority Normal Ticket',
      description: 'Should be first once 30m window expires',
      status: 'OPEN',
      priority: 'HIGH',
      teamId: 'team-1',
      createdById: 'u-admin',
      createdAt: twoHoursAgoIso,
      updatedAt: twoHoursAgoIso,
      version: 1,
      assignees: [
        {
          userId: 'user-logged-in',
          createdAt: twoHoursAgoIso,
          readAt: twoHoursAgoIso,
          user: { id: 'user-logged-in', name: 'Logged In User', email: 'me@example.com' },
        },
      ],
    };

    const lowNewlyAssignedTicket: any = {
      id: 't-low-expiring',
      title: 'Low Priority Expiring New Ticket',
      description: 'Promoted for 1 more minute, then returns to normal order',
      status: 'OPEN',
      priority: 'LOW',
      teamId: 'team-1',
      createdById: 'u-admin',
      createdAt: twoHoursAgoIso,
      updatedAt: assigned29MinsAgoIso,
      version: 1,
      assignees: [
        {
          userId: 'user-logged-in',
          createdAt: assigned29MinsAgoIso,
          readAt: null,
          user: { id: 'user-logged-in', name: 'Logged In User', email: 'me@example.com' },
        },
      ],
    };

    useTicketStore.setState({
      tickets: [highPriorityTicket, lowNewlyAssignedTicket],
      total: 2,
      loading: false,
      fetchTickets: vi.fn(),
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>
    );

    // At 29 minutes: "New" tag is visible and LOW ticket is at the top (index 0)
    expect(screen.getByTestId('new-unread-tag-t-low-expiring')).toBeInTheDocument();
    let cards = screen.getAllByTestId(/^ticket-card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'ticket-card-t-low-expiring');
    expect(cards[1]).toHaveAttribute('data-testid', 'ticket-card-t-high-normal');

    // Advance time by 2 minutes (now 31 minutes since assignment)
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    // Tag is automatically removed and HIGH ticket is now first, LOW ticket returned to second
    expect(screen.queryByTestId('new-unread-tag-t-low-expiring')).not.toBeInTheDocument();
    cards = screen.getAllByTestId(/^ticket-card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'ticket-card-t-high-normal');
    expect(cards[1]).toHaveAttribute('data-testid', 'ticket-card-t-low-expiring');

    // Note: even after 30 minutes, because the user still hasn't opened the ticket, it remains unread for the Unread filter!
    expect(isTicketUnreadForUser(lowNewlyAssignedTicket, 'user-logged-in')).toBe(true);
  });

  it('7. reading a ticket as one user does not affect the unread or newly-assigned state for another assigned user', () => {
    const now = Date.now();
    const tenMinsAgoIso = new Date(now - 10 * 60 * 1000).toISOString();
    const twoMinsAgoIso = new Date(now - 2 * 60 * 1000).toISOString();

    const sharedTicket: any = {
      id: 't-shared-assignees',
      title: 'Multi-Assignee Ticket',
      status: 'OPEN',
      priority: 'LOW',
      createdAt: tenMinsAgoIso,
      updatedAt: twoMinsAgoIso,
      version: 1,
      assignees: [
        {
          userId: 'user-a',
          createdAt: tenMinsAgoIso,
          readAt: twoMinsAgoIso, // User A has read it
          user: { id: 'user-a', name: 'User A', email: 'a@example.com' },
        },
        {
          userId: 'user-b',
          createdAt: tenMinsAgoIso,
          readAt: null, // User B has NOT read it
          user: { id: 'user-b', name: 'User B', email: 'b@example.com' },
        },
      ],
    };

    // For User A: already read, not newly assigned
    expect(isTicketUnreadForUser(sharedTicket, 'user-a')).toBe(false);
    expect(isTicketNewlyAssignedForUser(sharedTicket, 'user-a', now)).toBe(false);

    // For User B: still unread and within 30-minute newly assigned window
    expect(isTicketUnreadForUser(sharedTicket, 'user-b')).toBe(true);
    expect(isTicketNewlyAssignedForUser(sharedTicket, 'user-b', now)).toBe(true);

    // For User C (not assigned): neither unread nor newly assigned
    expect(isTicketUnreadForUser(sharedTicket, 'user-c')).toBe(false);
    expect(isTicketNewlyAssignedForUser(sharedTicket, 'user-c', now)).toBe(false);

    // Sorting for User B promotes sharedTicket above a HIGH ticket, while sorting for User A keeps HIGH ticket first
    const highTicket: any = {
      id: 't-high',
      title: 'High Ticket',
      status: 'OPEN',
      priority: 'HIGH',
      createdAt: tenMinsAgoIso,
      assignees: [],
    };

    const sortedForUserA = sortTicketsList([sharedTicket, highTicket], { sortBy: 'priority', sortOrder: 'desc' }, 'user-a', now);
    expect(sortedForUserA.map((t) => t.id)).toEqual(['t-high', 't-shared-assignees']);

    const sortedForUserB = sortTicketsList([sharedTicket, highTicket], { sortBy: 'priority', sortOrder: 'desc' }, 'user-b', now);
    expect(sortedForUserB.map((t) => t.id)).toEqual(['t-shared-assignees', 't-high']);
  });
});
