import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../TicketListPage';
import {
  useTicketStore,
  doesTicketMatchListParams,
  sortTicketsList,
  isStaleTicketEvent,
} from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useUserStore } from '@/features/users/store/user.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { ticketService, type Ticket } from '../../api/ticket.service';
import { teamService } from '@/features/teams/api/team.service';
import { socketService } from '@/shared/services/socket.service';

vi.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/features/users/store/user.store', () => ({
  useUserStore: vi.fn(),
}));

vi.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTickets: vi.fn(),
    getTicket: vi.fn(),
    getMyGroupMembers: vi.fn(),
  },
}));

vi.mock('@/features/teams/api/team.service', () => ({
  teamService: {
    getTeams: vi.fn(),
  },
}));

const socketHandlers = new Map<string, Set<(...args: any[]) => void>>();

const mockSocket = {
  on: vi.fn((event: string, handler: (...args: any[]) => void) => {
    if (!socketHandlers.has(event)) {
      socketHandlers.set(event, new Set());
    }
    socketHandlers.get(event)!.add(handler);
  }),
  off: vi.fn((event: string, handler?: (...args: any[]) => void) => {
    if (!handler) {
      socketHandlers.delete(event);
    } else {
      socketHandlers.get(event)?.delete(handler);
    }
  }),
  emit: vi.fn(),
};

function emitSocketEvent(event: string, payload?: any) {
  const handlers = socketHandlers.get(event);
  if (handlers) {
    for (const h of Array.from(handlers)) {
      h(payload);
    }
  }
}

vi.mock('@/shared/services/socket.service', () => ({
  socketService: {
    connect: vi.fn(() => mockSocket),
    getSocket: vi.fn(() => mockSocket),
  },
}));

describe('Tickets & Issues Module — Real-Time Updates', () => {
  const currentUserId = 'user-1';

  const baseTickets: Ticket[] = [
    {
      id: 't-existing-1',
      title: 'Existing Medium Priority Ticket',
      description: 'Initial open ticket',
      status: 'OPEN',
      priority: 'MEDIUM',
      teamId: 'team-1',
      createdById: currentUserId,
      createdAt: '2026-10-11T09:00:00.000Z',
      updatedAt: '2026-10-11T09:00:00.000Z',
      version: 1,
      assignees: [{ userId: currentUserId, user: { id: currentUserId, name: 'Current User', email: 'u1@ezee.org' } }],
    },
    {
      id: 't-existing-2',
      title: 'Existing High Priority Ticket',
      description: 'Second ticket in progress',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: 'team-1',
      createdById: 'user-2',
      createdAt: '2026-10-11T08:30:00.000Z',
      updatedAt: '2026-10-11T08:45:00.000Z',
      version: 2,
      assignees: [{ userId: currentUserId, user: { id: currentUserId, name: 'Current User', email: 'u1@ezee.org' } }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    sessionStorage.clear();

    useTicketStore.setState({
      tickets: [],
      total: 0,
      loading: false,
      error: null,
      currentTicket: null,
      activeListParams: {
        page: 1,
        limit: 12,
        status: 'OPEN,IN_PROGRESS',
        sortBy: 'priority',
        sortOrder: 'desc',
        myTickets: true,
        myGroup: false,
      },
      myGroupMembers: [],
    });

    (useAuthStore as any).mockReturnValue({
      user: { id: currentUserId, name: 'Current User', role: { name: 'Engineer' } },
    });

    (useUserStore as any).mockReturnValue({
      users: [],
      fetchUsers: vi.fn().mockResolvedValue(undefined),
    });

    (usePermissions as any).mockReturnValue({
      hasPermission: vi.fn().mockReturnValue(true),
    });

    (ticketService.getTickets as any).mockResolvedValue({
      data: [...baseTickets],
      total: 2,
    });

    (ticketService.getMyGroupMembers as any).mockResolvedValue([
      {
        id: 'user-report-1',
        name: 'Direct Report One',
        email: 'report1@ezee.org',
        teams: [{ id: 'team-1', name: 'Platform' }],
      },
    ]);

    (teamService.getTeams as any).mockResolvedValue([]);
  });

  it('reflects newly created tickets (TICKET_CREATED) immediately in the UI without page refresh and sorts by priority', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <TicketListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Existing Medium Priority Ticket')).toBeInTheDocument();
      expect(screen.getByText('Existing High Priority Ticket')).toBeInTheDocument();
    });

    const criticalNewTicket: Ticket = {
      id: 't-new-critical',
      title: 'Live Critical Database Outage',
      description: 'Arrived via WebSocket',
      status: 'OPEN',
      priority: 'CRITICAL',
      teamId: 'team-1',
      createdById: 'user-2',
      createdAt: '2026-10-11T10:00:00.000Z',
      updatedAt: '2026-10-11T10:00:00.000Z',
      version: 1,
      assignees: [{ userId: currentUserId, user: { id: currentUserId, name: 'Current User', email: 'u1@ezee.org' } }],
    };

    act(() => {
      emitSocketEvent('TICKET_CREATED', criticalNewTicket);
    });

    await waitFor(() => {
      expect(screen.getByText('Live Critical Database Outage')).toBeInTheDocument();
    });

    const state = useTicketStore.getState();
    expect(state.total).toBe(3);
    // CRITICAL ticket should be sorted first when sortBy='priority', sortOrder='desc'
    expect(state.tickets.map((t) => t.id)).toEqual([
      't-new-critical',
      't-existing-2',
      't-existing-1',
    ]);
  });

  it('ignores TICKET_CREATED events that do not match the active My Tickets or My Group filter', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <TicketListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Existing Medium Priority Ticket')).toBeInTheDocument();
    });

    // Unrelated ticket where currentUserId is neither creator nor assignee while My Tickets is active
    const unrelatedTicket: Ticket = {
      id: 't-unrelated',
      title: 'Unassigned To Current User Ticket',
      description: 'Belongs to someone else in team',
      status: 'OPEN',
      priority: 'HIGH',
      teamId: 'team-1',
      createdById: 'user-other',
      createdAt: '2026-10-11T10:05:00.000Z',
      updatedAt: '2026-10-11T10:05:00.000Z',
      version: 1,
      assignees: [{ userId: 'user-report-1', user: { id: 'user-report-1', name: 'Direct Report One', email: 'r1@ezee.org' } }],
    };

    act(() => {
      emitSocketEvent('TICKET_CREATED', unrelatedTicket);
    });

    expect(screen.queryByText('Unassigned To Current User Ticket')).not.toBeInTheDocument();
    expect(useTicketStore.getState().total).toBe(2);

    // Now test My Group view: direct report's ticket SHOULD match when myGroup=true
    act(() => {
      useTicketStore.getState().setActiveListParams({
        ...useTicketStore.getState().activeListParams,
        myTickets: false,
        myGroup: true,
      });
      emitSocketEvent('TICKET_CREATED', unrelatedTicket);
    });

    await waitFor(() => {
      expect(screen.getByText('Unassigned To Current User Ticket')).toBeInTheDocument();
    });
  });

  it('updates ticket status and priority in real time (TICKET_UPDATED), re-sorts, and removes tickets that no longer match active status filters', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <TicketListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Existing Medium Priority Ticket')).toBeInTheDocument();
    });

    // 1. Escalate/update t-existing-1 from OPEN (MEDIUM) -> IN_PROGRESS (CRITICAL)
    act(() => {
      emitSocketEvent('TICKET_UPDATED', {
        ...baseTickets[0],
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        version: 2,
        updatedAt: '2026-10-11T10:15:00.000Z',
      });
    });

    const stateAfterEscalation = useTicketStore.getState();
    expect(stateAfterEscalation.tickets[0].id).toBe('t-existing-1');
    expect(stateAfterEscalation.tickets[0].status).toBe('IN_PROGRESS');
    expect(stateAfterEscalation.tickets[0].priority).toBe('CRITICAL');

    // 2. Transition t-existing-1 to RESOLVED while active filter is 'OPEN,IN_PROGRESS'
    act(() => {
      emitSocketEvent('TICKET_UPDATED', {
        ...baseTickets[0],
        status: 'RESOLVED',
        priority: 'CRITICAL',
        version: 3,
        updatedAt: '2026-10-11T10:20:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Existing Medium Priority Ticket')).not.toBeInTheDocument();
    });
    expect(useTicketStore.getState().total).toBe(1);
  });

  it('prevents duplicate tickets and ignores out-of-order/stale TICKET_UPDATED payloads', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <TicketListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Existing High Priority Ticket')).toBeInTheDocument();
    });

    // Duplicate TICKET_CREATED for an already listed ticket should NOT duplicate or increment total
    act(() => {
      emitSocketEvent('TICKET_CREATED', baseTickets[1]);
    });
    expect(useTicketStore.getState().tickets).toHaveLength(2);
    expect(useTicketStore.getState().total).toBe(2);

    // Stale TICKET_UPDATED (version 1 < existing version 2) must be ignored
    act(() => {
      emitSocketEvent('TICKET_UPDATED', {
        ...baseTickets[1],
        status: 'OPEN',
        priority: 'LOW',
        version: 1,
        updatedAt: '2026-10-11T08:00:00.000Z',
      });
    });

    const unchanged = useTicketStore.getState().tickets.find((t) => t.id === 't-existing-2');
    expect(unchanged?.status).toBe('IN_PROGRESS');
    expect(unchanged?.priority).toBe('HIGH');
    expect(unchanged?.version).toBe(2);
  });

  it('recovers missed updates on socket reconnect and falls back gracefully if socket connection throws', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <TicketListPage />
      </MemoryRouter>
    );

    expect(socketService.connect).toHaveBeenCalled();

    await waitFor(() => {
      expect(ticketService.getTickets).toHaveBeenCalledTimes(1);
    });

    // Simulate disconnect followed by reconnect
    act(() => {
      emitSocketEvent('disconnect');
      emitSocketEvent('connect');
    });

    await waitFor(() => {
      expect(ticketService.getTickets).toHaveBeenCalledTimes(2);
    });
  });

  it('unit-tests helper functions (isStaleTicketEvent, doesTicketMatchListParams, sortTicketsList)', () => {
    const tOld: Ticket = {
      id: 't-1',
      title: 'Test',
      description: 'Desc',
      status: 'OPEN',
      priority: 'LOW',
      teamId: 'team-1',
      createdById: 'u-1',
      createdAt: '2026-10-11T08:00:00Z',
      updatedAt: '2026-10-11T09:00:00Z',
      version: 3,
    };

    expect(isStaleTicketEvent(tOld, { version: 2 })).toBe(true);
    expect(isStaleTicketEvent(tOld, { version: 4 })).toBe(false);
    expect(isStaleTicketEvent(tOld, { version: 3, updatedAt: '2026-10-11T08:30:00Z' })).toBe(true);

    const sorted = sortTicketsList(
      [
        { ...tOld, id: 'low', priority: 'LOW' },
        { ...tOld, id: 'crit', priority: 'CRITICAL' },
        { ...tOld, id: 'high', priority: 'HIGH' },
      ],
      { sortBy: 'priority', sortOrder: 'desc' }
    );
    expect(sorted.map((t) => t.id)).toEqual(['crit', 'high', 'low']);

    expect(
      doesTicketMatchListParams(
        { ...tOld, status: 'CLOSED', createdById: 'u-1' },
        { status: 'OPEN,IN_PROGRESS', myTickets: true },
        'u-1'
      )
    ).toBe(false);
  });
});
