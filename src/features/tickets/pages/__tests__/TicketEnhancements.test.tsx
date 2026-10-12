import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDashboardPage } from '../TicketDashboardPage';
import { TicketListPage } from '../TicketListPage';
import { TicketDetailsPage } from '../TicketDetailsPage';
import { useTicketStore } from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useUserStore } from '@/features/users/store/user.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { ticketService, type Ticket } from '../../api/ticket.service';
import { teamService } from '@/features/teams/api/team.service';
import {
  computeTicketEscalationTiming,
  canUserExtendTicketEscalation,
  zonedDateToUtc,
} from '../../utils/escalation-time.util';

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
    getHolidayDates: vi.fn(),
    extendEscalationTime: vi.fn(),
    getUsersMentionLookup: vi.fn(),
  },
}));

vi.mock('@/features/teams/api/team.service', () => ({
  teamService: {
    getTeams: vi.fn(),
  },
}));

vi.mock('@/shared/services/socket.service', () => ({
  socketService: {
    connect: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    })),
    getSocket: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    })),
  },
}));

vi.mock('emoji-picker-react', () => ({
  default: () => <div data-testid="emoji-picker" />,
}));

describe('Tickets & Issues Module Enhancements (Dashboard Subtab, Extend Escalation Time, Remaining Time)', () => {
  const tz = 'Asia/Kolkata';

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();

    (usePermissions as any).mockReturnValue({
      hasPermission: (perm: string) =>
        ['tickets:read', 'tickets:create', 'tickets:comment'].includes(perm),
    });

    (useUserStore as any).mockReturnValue({
      users: [],
      fetchUsers: vi.fn().mockResolvedValue(undefined),
    });

    (teamService.getTeams as any).mockResolvedValue({ data: [] });
    (ticketService.getMyGroupMembers as any).mockResolvedValue([]);
    (ticketService.getHolidayDates as any).mockResolvedValue([]);
    (ticketService.getUsersMentionLookup as any).mockResolvedValue([]);

    useTicketStore.setState({
      tickets: [],
      total: 0,
      currentTicket: null,
      loading: false,
      error: null,
      holidayDates: [],
    });
  });

  describe('1. Dashboard Subtab Placeholder', () => {
    it('renders the Tickets & Issues Dashboard subtab placeholder cleanly without unrequested metrics', () => {
      render(
        <MemoryRouter initialEntries={['/tickets/dashboard']}>
          <Routes>
            <Route path="/tickets/dashboard" element={<TicketDashboardPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('tickets-dashboard-placeholder')).toBeInTheDocument();
      expect(screen.getByText('Tickets & Issues Dashboard')).toBeInTheDocument();
    });
  });

  describe('2. Escalation Time Remaining Utility & Display', () => {
    it('computes remaining active working time, pauses on Sundays/holidays, and reflects extended minutes', () => {
      // Created Monday 2026-10-12 10:30 AM IST. Base threshold = 2h (12:30 PM).
      const createdAt = zonedDateToUtc(2026, 10, 12, 10, 30, 0, tz).toISOString();
      const now = zonedDateToUtc(2026, 10, 12, 11, 15, 0, tz); // 45m elapsed -> 1h 15m left

      const baseTiming = computeTicketEscalationTiming(
        {
          status: 'OPEN',
          createdAt,
          escalationExtendedMinutes: 0,
        },
        now,
        tz,
        []
      );

      expect(baseTiming.isApplicable).toBe(true);
      expect(baseTiming.remainingMs).toBe(75 * 60 * 1000);
      expect(baseTiming.shortRemaining).toBe('1h 15m left');

      // With +60m extension -> 2h 15m left
      const extendedTiming = computeTicketEscalationTiming(
        {
          status: 'OPEN',
          createdAt,
          escalationExtendedMinutes: 60,
        },
        now,
        tz,
        []
      );
      expect(extendedTiming.remainingMs).toBe(135 * 60 * 1000);
      expect(extendedTiming.shortRemaining).toBe('2h 15m left');
    });

    it('displays remaining escalation time on OPEN and IN_PROGRESS ticket cards in TicketListPage', async () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: 'user-assignee', name: 'Assignee User', role: { name: 'Developer' } },
      });

      const sampleTickets: Ticket[] = [
        {
          id: 'ticket-open-1',
          title: 'Active Open Issue',
          description: 'Needs attention',
          status: 'OPEN',
          priority: 'HIGH',
          teamId: 'team-1',
          createdById: 'user-assignor',
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          escalationExtendedMinutes: 30,
          version: 1,
          assignees: [
            {
              userId: 'user-assignee',
              user: { id: 'user-assignee', name: 'Assignee User', email: 'a@ezee.org' },
            },
          ],
        },
      ];

      (ticketService.getTickets as any).mockResolvedValue({
        data: sampleTickets,
        total: 1,
      });

      render(
        <MemoryRouter initialEntries={['/tickets']}>
          <TicketListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('escalation-remaining-ticket-open-1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('escalation-remaining-ticket-open-1').textContent).toContain('(+30m)');
    });
  });

  describe('3. Extend Escalation Time (Assignee & Assignor Authorization)', () => {
    const baseOpenTicket: Ticket = {
      id: 'ticket-detail-1',
      title: 'Production API Timeout',
      description: 'Investigating gateway latency',
      status: 'OPEN',
      priority: 'HIGH',
      teamId: 'team-1',
      createdById: 'user-assignor',
      createdBy: { id: 'user-assignor', name: 'Assignor Alice', email: 'alice@ezee.org' },
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      escalationExtendedMinutes: 0,
      version: 1,
      assignees: [
        {
          userId: 'user-assignee',
          user: { id: 'user-assignee', name: 'Assignee Bob', email: 'bob@ezee.org' },
        },
      ],
      messages: [],
    };

    it('verifies canUserExtendTicketEscalation strictly permits only Assignee and Assignor on OPEN/IN_PROGRESS tickets', () => {
      expect(canUserExtendTicketEscalation(baseOpenTicket, 'user-assignee')).toBe(true);
      expect(canUserExtendTicketEscalation(baseOpenTicket, 'user-assignor')).toBe(true);
      expect(canUserExtendTicketEscalation(baseOpenTicket, 'user-other')).toBe(false);
      expect(canUserExtendTicketEscalation(baseOpenTicket, 'user-super-admin')).toBe(false);
      expect(
        canUserExtendTicketEscalation({ ...baseOpenTicket, status: 'RESOLVED' }, 'user-assignee')
      ).toBe(false);
    });

    it('allows Assignee to open the Extend Escalation Time modal and submit an extension on TicketDetailsPage', async () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: 'user-assignee', name: 'Assignee Bob', role: { name: 'Developer' } },
      });

      (ticketService.getTicket as any).mockResolvedValue({ data: baseOpenTicket });
      (ticketService.extendEscalationTime as any).mockResolvedValue({
        data: {
          ...baseOpenTicket,
          escalationExtendedMinutes: 120,
          version: 2,
        },
      });

      render(
        <MemoryRouter initialEntries={['/tickets/ticket-detail-1']}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ticket-details-escalation-section')).toBeInTheDocument();
      });

      const extendBtn = screen.getByTestId('extend-escalation-btn');
      expect(extendBtn).toBeInTheDocument();

      fireEvent.click(extendBtn);

      await waitFor(() => {
        expect(screen.getByTestId('extend-escalation-modal')).toBeInTheDocument();
      });

      // Select +2h (120 mins) preset and submit
      fireEvent.click(screen.getByTestId('extend-preset-120'));
      fireEvent.click(screen.getByTestId('confirm-extend-escalation-btn'));

      await waitFor(() => {
        expect(ticketService.extendEscalationTime).toHaveBeenCalledWith('ticket-detail-1', {
          additionalMinutes: 120,
          reason: undefined,
        });
      });
    });

    it('hides the Extend Escalation Time button for users who are neither Assignee nor Assignor', async () => {
      (useAuthStore as any).mockReturnValue({
        user: {
          id: 'user-unauthorized-observer',
          name: 'Observer User',
          role: { name: 'Super Admin' },
        },
      });

      (ticketService.getTicket as any).mockResolvedValue({ data: baseOpenTicket });

      render(
        <MemoryRouter initialEntries={['/tickets/ticket-detail-1']}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ticket-details-escalation-section')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('extend-escalation-btn')).not.toBeInTheDocument();
    });
  });
});
