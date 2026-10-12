import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDashboardPage } from '../TicketDashboardPage';
import { ticketService } from '../../api/ticket.service';
import { teamService } from '@/features/teams/api/team.service';
import { useAuthStore } from '@/features/auth/store/auth.store';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getDashboardMetrics: vi.fn(),
  },
}));

vi.mock('@/features/teams/api/team.service', () => ({
  teamService: {
    getTeams: vi.fn(),
  },
}));

vi.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

const makeMyOverviewResponse = (overrides?: Record<string, any>) => ({
  scope: 'my_overview',
  isReportingOfficer: false,
  canViewGroup: false,
  groupMembers: [],
  authorizedTeams: [],
  period: {
    preset: 'last_30_days',
    startDate: '2026-09-13T00:00:00.000Z',
    endDate: '2026-10-12T15:00:00.000Z',
    timeZone: 'Asia/Kolkata',
  },
  summary: {
    total: 12,
    open: 3,
    inProgress: 2,
    reopened: 1,
    pending: 4,
    resolved: 5,
    closed: 2,
    resolvedOrClosed: 7,
    active: 6,
    escalated: 1,
    escalationEvents: 1,
    overdue: 2,
    awaitingAction: 6,
    unread: 1,
    resolutionRate: 58,
    escalationRate: 8,
  },
  statusDistribution: [
    { status: 'OPEN', label: 'Open', count: 3, percentage: 25 },
    { status: 'IN_PROGRESS', label: 'In Progress', count: 2, percentage: 17 },
    { status: 'REOPENED', label: 'Reopened', count: 1, percentage: 8 },
    { status: 'RESOLVED', label: 'Resolved', count: 4, percentage: 33 },
    { status: 'CLOSED', label: 'Closed', count: 2, percentage: 17 },
  ],
  resolutionPerformance: {
    totalAssigned: 12,
    eligibleForResolution: 12,
    totalResolved: 7,
    validResolvedCount: 7,
    avgResolutionTimeMs: 7200000,
    avgResolutionTimeMinutes: 120,
    formattedAvgResolutionTime: '2h',
    avgBusinessResolutionTimeMs: 5400000,
    avgBusinessResolutionTimeMinutes: 90,
    formattedAvgBusinessResolutionTime: '1h 30m',
    resolutionRate: 58,
    escalatedCount: 1,
    escalationEventsCount: 1,
    escalationRate: 8,
    overdueCount: 2,
    awaitingActionCount: 6,
  },
  resolutionTrend: [
    {
      date: '2026-10-10',
      label: 'Oct 10',
      assigned: 5,
      resolved: 3,
      escalated: 1,
    },
    {
      date: '2026-10-12',
      label: 'Oct 12',
      assigned: 7,
      resolved: 4,
      escalated: 0,
    },
  ],
  memberPerformance: [],
  topEscalatedUsers: [],
  fastestResolver: null,
  groupAverageResolution: {
    avgResolutionTimeMs: 7200000,
    avgResolutionTimeMinutes: 120,
    formattedAvgResolutionTime: '2h',
    avgBusinessResolutionTimeMs: 5400000,
    avgBusinessResolutionTimeMinutes: 90,
    formattedAvgBusinessResolutionTime: '1h 30m',
    totalResolvedTickets: 7,
    validResolvedTickets: 7,
  },
  ...overrides,
});

const makeGroupOverviewResponse = (overrides?: Record<string, any>) => ({
  scope: 'group_overview',
  isReportingOfficer: true,
  canViewGroup: true,
  groupMembers: [
    {
      id: 'u-alice',
      name: 'Alice Smith',
      email: 'alice@ezee.org',
      designation: 'Senior Engineer',
      roleName: 'Developer',
      teams: [{ id: 'team-1', name: 'Platform' }],
    },
    {
      id: 'u-bob',
      name: 'Bob Jones',
      email: 'bob@ezee.org',
      designation: 'Backend Engineer',
      roleName: 'Developer',
      teams: [{ id: 'team-1', name: 'Platform' }],
    },
    {
      id: 'u-charlie',
      name: 'Charlie Brown',
      email: 'charlie@ezee.org',
      designation: 'QA Engineer',
      roleName: 'Tester',
      teams: [{ id: 'team-1', name: 'Platform' }],
    },
  ],
  authorizedTeams: [{ id: 'team-1', name: 'Platform' }],
  period: {
    preset: 'last_30_days',
    startDate: '2026-09-13T00:00:00.000Z',
    endDate: '2026-10-12T15:00:00.000Z',
    timeZone: 'Asia/Kolkata',
  },
  summary: {
    total: 25,
    open: 5,
    inProgress: 4,
    reopened: 1,
    pending: 6,
    resolved: 10,
    closed: 5,
    resolvedOrClosed: 15,
    active: 10,
    escalated: 6,
    escalationEvents: 7,
    overdue: 3,
    awaitingAction: 10,
    unread: 2,
    resolutionRate: 60,
    escalationRate: 24,
  },
  statusDistribution: [
    { status: 'OPEN', label: 'Open', count: 5, percentage: 20 },
    { status: 'IN_PROGRESS', label: 'In Progress', count: 4, percentage: 16 },
    { status: 'REOPENED', label: 'Reopened', count: 1, percentage: 4 },
    { status: 'RESOLVED', label: 'Resolved', count: 10, percentage: 40 },
    { status: 'CLOSED', label: 'Closed', count: 5, percentage: 20 },
  ],
  resolutionPerformance: {
    totalAssigned: 25,
    eligibleForResolution: 25,
    totalResolved: 15,
    validResolvedCount: 15,
    avgResolutionTimeMs: 10800000,
    avgResolutionTimeMinutes: 180,
    formattedAvgResolutionTime: '3h',
    avgBusinessResolutionTimeMs: 6300000,
    avgBusinessResolutionTimeMinutes: 105,
    formattedAvgBusinessResolutionTime: '1h 45m',
    resolutionRate: 60,
    escalatedCount: 6,
    escalationEventsCount: 7,
    escalationRate: 24,
    overdueCount: 3,
    awaitingActionCount: 10,
  },
  resolutionTrend: [
    {
      date: '2026-10-11',
      label: 'Oct 11',
      assigned: 12,
      resolved: 8,
      escalated: 3,
    },
  ],
  groupAverageResolution: {
    avgResolutionTimeMs: 10800000,
    avgResolutionTimeMinutes: 180,
    formattedAvgResolutionTime: '3h',
    avgBusinessResolutionTimeMs: 6300000,
    avgBusinessResolutionTimeMinutes: 105,
    formattedAvgBusinessResolutionTime: '1h 45m',
    totalResolvedTickets: 15,
    validResolvedTickets: 15,
  },
  topEscalatedUsers: [
    {
      rank: 1,
      userId: 'u-bob',
      userName: 'Bob Jones',
      email: 'bob@ezee.org',
      designation: 'Backend Engineer',
      roleName: 'Developer',
      escalatedTickets: 3,
      escalationEvents: 4,
      totalTickets: 8,
      overdueTickets: 2,
      escalationRate: 38,
    },
    {
      rank: 2,
      userId: 'u-alice',
      userName: 'Alice Smith',
      email: 'alice@ezee.org',
      designation: 'Senior Engineer',
      roleName: 'Developer',
      escalatedTickets: 2,
      escalationEvents: 2,
      totalTickets: 10,
      overdueTickets: 0,
      escalationRate: 20,
    },
    {
      rank: 3,
      userId: 'u-charlie',
      userName: 'Charlie Brown',
      email: 'charlie@ezee.org',
      designation: 'QA Engineer',
      roleName: 'Tester',
      escalatedTickets: 1,
      escalationEvents: 1,
      totalTickets: 7,
      overdueTickets: 1,
      escalationRate: 14,
    },
  ],
  fastestResolver: {
    userId: 'u-alice',
    userName: 'Alice Smith',
    email: 'alice@ezee.org',
    designation: 'Senior Engineer',
    roleName: 'Developer',
    avgResolutionTimeMs: 4500000,
    avgResolutionTimeMinutes: 75,
    formattedAvgResolutionTime: '1h 15m',
    avgBusinessResolutionTimeMs: 3600000,
    avgBusinessResolutionTimeMinutes: 60,
    formattedAvgBusinessResolutionTime: '1h',
    resolvedTickets: 8,
    validResolvedCount: 8,
    totalTickets: 10,
    resolutionRate: 80,
    minSampleSize: 3,
    isLimitedSample: false,
    sampleSizeNote: null,
  },
  memberPerformance: [
    {
      userId: 'u-alice',
      userName: 'Alice Smith',
      email: 'alice@ezee.org',
      designation: 'Senior Engineer',
      roleName: 'Developer',
      teams: [{ id: 'team-1', name: 'Platform' }],
      totalTickets: 10,
      openTickets: 1,
      inProgressTickets: 1,
      reopenedTickets: 0,
      pendingTickets: 1,
      activeTickets: 2,
      resolvedTickets: 8,
      validResolvedCount: 8,
      escalatedTickets: 2,
      escalationEvents: 2,
      overdueTickets: 0,
      awaitingActionTickets: 1,
      avgResolutionTimeMs: 4500000,
      avgResolutionTimeMinutes: 75,
      formattedAvgResolutionTime: '1h 15m',
      avgBusinessResolutionTimeMs: 3600000,
      avgBusinessResolutionTimeMinutes: 60,
      formattedAvgBusinessResolutionTime: '1h',
      resolutionRate: 80,
      escalationRate: 20,
    },
    {
      userId: 'u-bob',
      userName: 'Bob Jones',
      email: 'bob@ezee.org',
      designation: 'Backend Engineer',
      roleName: 'Developer',
      teams: [{ id: 'team-1', name: 'Platform' }],
      totalTickets: 8,
      openTickets: 2,
      inProgressTickets: 2,
      reopenedTickets: 1,
      pendingTickets: 3,
      activeTickets: 5,
      resolvedTickets: 3,
      validResolvedCount: 3,
      escalatedTickets: 3,
      escalationEvents: 4,
      overdueTickets: 2,
      awaitingActionTickets: 3,
      avgResolutionTimeMs: 14400000,
      avgResolutionTimeMinutes: 240,
      formattedAvgResolutionTime: '4h',
      avgBusinessResolutionTimeMs: 9000000,
      avgBusinessResolutionTimeMinutes: 150,
      formattedAvgBusinessResolutionTime: '2h 30m',
      resolutionRate: 38,
      escalationRate: 38,
    },
  ],
  ...overrides,
});

describe('TicketDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (teamService.getTeams as any).mockResolvedValue({ data: [] });
    (useAuthStore as any).mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Regular User',
        role: { name: 'Employee' },
      },
    });
  });

  it('1. Regular user views personal dashboard metrics and does not see Group Overview switcher', async () => {
    (ticketService.getDashboardMetrics as any).mockResolvedValue(makeMyOverviewResponse());

    render(
      <MemoryRouter initialEntries={['/tickets/dashboard']}>
        <Routes>
          <Route path="/tickets/dashboard" element={<TicketDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-summary-grid')).toBeInTheDocument();
    });

    // Regular user should NOT see the My Overview / Group Overview scope switcher
    expect(screen.queryByTestId('ticket-dashboard-scope-switcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('group-highlights-row')).not.toBeInTheDocument();

    // Summary KPI cards are rendered accurately
    expect(screen.getByTestId('kpi-total-tickets')).toHaveTextContent('12');
    expect(screen.getByTestId('kpi-open-tickets')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-in-progress-tickets')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-pending-tickets')).toHaveTextContent('4');
    expect(screen.getByTestId('kpi-resolved-tickets')).toHaveTextContent('7');
    expect(screen.getByTestId('kpi-escalated-tickets')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-overdue-tickets')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-awaiting-action-tickets')).toHaveTextContent('6');

    // Individual Resolution Performance metrics are rendered
    expect(screen.getByTestId('avg-resolution-time-value')).toHaveTextContent('2h');
    expect(screen.getByTestId('avg-business-resolution-time-value')).toHaveTextContent('1h 30m');
    expect(screen.getByTestId('metric-resolution-rate')).toHaveTextContent('58%');
  });

  it('2. Reporting officer switches between My Overview and Group Overview and sees Top 3 Escalations, Fastest Resolver, and Group Avg Resolution Time', async () => {
    (ticketService.getDashboardMetrics as any).mockImplementation(async (params: any) => {
      if (params?.scope === 'group_overview') {
        return makeGroupOverviewResponse();
      }
      return makeMyOverviewResponse({
        isReportingOfficer: true,
        canViewGroup: true,
        groupMembers: makeGroupOverviewResponse().groupMembers,
      });
    });

    render(
      <MemoryRouter initialEntries={['/tickets/dashboard']}>
        <Routes>
          <Route path="/tickets/dashboard" element={<TicketDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial My Overview load with scope switcher visible
    await waitFor(() => {
      expect(screen.getByTestId('ticket-dashboard-scope-switcher')).toBeInTheDocument();
    });

    expect(screen.getByTestId('kpi-total-tickets')).toHaveTextContent('12');

    // Switch to Group Overview
    fireEvent.click(screen.getByTestId('scope-group-overview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('group-highlights-row')).toBeInTheDocument();
    });

    // Verify Group KPI totals (deduplicated)
    expect(screen.getByTestId('kpi-total-tickets')).toHaveTextContent('25');
    expect(screen.getByTestId('kpi-resolved-tickets')).toHaveTextContent('15');

    // Verify Group Average Resolution Time card
    expect(screen.getByTestId('group-avg-resolution-card')).toHaveTextContent('3h');
    expect(screen.getByTestId('group-avg-resolution-card')).toHaveTextContent('1h 45m');

    // Verify Fastest Issue Resolver card
    const fastestCard = screen.getByTestId('fastest-resolver-card');
    expect(fastestCard).toHaveTextContent('Alice Smith');
    expect(fastestCard).toHaveTextContent('1h 15m');
    expect(screen.getByTestId('fastest-resolver-count')).toHaveTextContent('8');

    // Verify Top 3 Users With Highest Escalations card
    expect(screen.getByTestId('top-escalated-rank-1')).toHaveTextContent('Bob Jones');
    expect(screen.getByTestId('top-escalated-rank-1')).toHaveTextContent('3 Escalated Tickets');
    expect(screen.getByTestId('top-escalated-rank-2')).toHaveTextContent('Alice Smith');
    expect(screen.getByTestId('top-escalated-rank-2')).toHaveTextContent('2 Escalated Tickets');
    expect(screen.getByTestId('top-escalated-rank-3')).toHaveTextContent('Charlie Brown');
    expect(screen.getByTestId('top-escalated-rank-3')).toHaveTextContent('1 Escalated Ticket');

    // Verify Group Member Performance breakdown card
    expect(screen.getByTestId('group-member-performance-card')).toBeInTheDocument();
    expect(screen.getByTestId('member-filter-btn-u-alice')).toBeInTheDocument();
    expect(screen.getByTestId('member-filter-btn-u-bob')).toBeInTheDocument();
  });

  it('3. Changing the reporting period dynamically refreshes all dashboard metrics without page reload', async () => {
    (ticketService.getDashboardMetrics as any).mockImplementation(async (params: any) => {
      if (params?.period === 'last_7_days') {
        return makeMyOverviewResponse({
          period: {
            preset: 'last_7_days',
            startDate: '2026-10-06T00:00:00.000Z',
            endDate: '2026-10-12T15:00:00.000Z',
            timeZone: 'Asia/Kolkata',
          },
          summary: {
            total: 5,
            open: 1,
            inProgress: 1,
            reopened: 0,
            pending: 1,
            resolved: 2,
            closed: 1,
            resolvedOrClosed: 3,
            active: 2,
            escalated: 0,
            escalationEvents: 0,
            overdue: 0,
            awaitingAction: 2,
            unread: 0,
            resolutionRate: 60,
            escalationRate: 0,
          },
        });
      }
      return makeMyOverviewResponse();
    });

    render(
      <MemoryRouter initialEntries={['/tickets/dashboard']}>
        <Routes>
          <Route path="/tickets/dashboard" element={<TicketDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-tickets')).toHaveTextContent('12');
    });

    // Click "Last 7 Days" preset button
    fireEvent.click(screen.getByTestId('period-btn-last_7_days'));

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-tickets')).toHaveTextContent('5');
    });
    expect(ticketService.getDashboardMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'last_7_days',
      })
    );
  });

  it('4. Displays clear empty states when a selected period has no escalations or no resolved tickets', async () => {
    (ticketService.getDashboardMetrics as any).mockResolvedValue(
      makeGroupOverviewResponse({
        summary: {
          total: 0,
          open: 0,
          inProgress: 0,
          reopened: 0,
          pending: 0,
          resolved: 0,
          closed: 0,
          resolvedOrClosed: 0,
          active: 0,
          escalated: 0,
          escalationEvents: 0,
          overdue: 0,
          awaitingAction: 0,
          unread: 0,
          resolutionRate: 0,
          escalationRate: 0,
        },
        topEscalatedUsers: [],
        fastestResolver: null,
        memberPerformance: [],
      })
    );

    render(
      <MemoryRouter initialEntries={['/tickets/dashboard']}>
        <Routes>
          <Route path="/tickets/dashboard" element={<TicketDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-dashboard-scope-switcher')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('scope-group-overview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('fastest-resolver-empty')).toBeInTheDocument();
      expect(screen.getByTestId('top-escalated-empty')).toBeInTheDocument();
    });
  });
});
