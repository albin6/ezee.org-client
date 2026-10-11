import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../../store/ticket.store';
import { useUserStore } from '@/features/users/store/user.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ticketService } from '../../api/ticket.service';
import dayjs from 'dayjs';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getMyGroupMembers: vi.fn().mockResolvedValue([]),
    getHolidays: vi.fn().mockResolvedValue([]),
    addHoliday: vi.fn().mockImplementation(async ({ date }) => ({ id: `hol-${date}`, date })),
    removeHoliday: vi.fn().mockImplementation(async (date) => ({ date, removed: true })),
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

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([]);
  vi.mocked(ticketService.getHolidays).mockResolvedValue([]);
  useAuthStore.setState({
    user: { id: 'u-regular', name: 'Regular User', role: { name: 'Developer' } } as any,
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

  useTicketStore.setState({
    tickets: [
      {
        id: 't-1',
        title: 'PostgreSQL connection pool exhausted',
        description: 'Connections dropped under peak traffic',
        status: 'OPEN',
        priority: 'HIGH',
        teamId: 'team-1',
        createdById: 'u-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        similarityScore: 0.92,
        assignees: [
          { userId: 'u-2', user: { id: 'u-2', name: 'Dev Lead', email: 'dev@example.com' } },
        ],
      } as any,
    ],
    total: 1,
    loading: false,
    fetchTickets: vi.fn(),
  });
});

describe('TicketListPage - Semantic Search', () => {
  it('renders search bar with Semantic AI mode active by default', async () => {
    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/✨ Semantic AI/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/semantic search: describe an issue/i),
    ).toBeInTheDocument();
  });

  it('toggles between Semantic AI and Keyword search mode when clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    const toggleBtn = screen.getByRole('button', { name: /✨ Semantic AI/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/🔍 Keyword/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search by title, description or id/i)).toBeInTheDocument();
    });
  });

  it('displays the semantic relevance percentage match badge on ticket cards', async () => {
    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('PostgreSQL connection pool exhausted')).toBeInTheDocument();
    expect(screen.getByText('✨ 92%')).toBeInTheDocument();
  });
});

describe('TicketListPage - My Tickets and Filter Persistence', () => {
  it('renders My Tickets toggle active by default and requests tickets with myTickets: true', async () => {
    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /My Tickets ✓/i })).toBeInTheDocument();
    expect(screen.getByText('Viewing: My Tickets')).toBeInTheDocument();
    expect(fetchTicketsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        myTickets: true,
        status: 'OPEN,IN_PROGRESS',
        sortBy: 'priority',
        sortOrder: 'desc',
      })
    );
  });

  it('defaults to OPEN,IN_PROGRESS statuses and priority:desc sorting on initial load', async () => {
    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    expect(fetchTicketsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'OPEN,IN_PROGRESS',
        sortBy: 'priority',
        sortOrder: 'desc',
        page: 1,
        limit: 12,
      })
    );
  });

  it('toggles My Tickets to All Visible Tickets when clicked and refetches with myTickets: false', async () => {
    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    const toggleBtn = screen.getByRole('button', { name: /My Tickets ✓/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /All Visible Tickets/i })).toBeInTheDocument();
      expect(screen.getByText('Viewing: All Visible Tickets')).toBeInTheDocument();
      expect(fetchTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          myTickets: false,
        })
      );
    });
  });

  it('restores filters from initial URL search params', async () => {
    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter initialEntries={['/tickets?myTickets=false&status=OPEN&priority=HIGH&search=database']}>
        <TicketListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /All Visible Tickets/i })).toBeInTheDocument();
      expect(fetchTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          myTickets: false,
          status: 'OPEN',
          priority: 'HIGH',
          search: 'database',
        })
      );
    });
  });
});

describe('TicketListPage - My Group Filter', () => {
  it('does not display My Group button when user has no direct reports', async () => {
    vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /My Tickets ✓/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^My Group/i })).not.toBeInTheDocument();
    });
  });

  it('displays My Group button alongside My Tickets when user has direct reports', async () => {
    vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([
      { id: 'user-report-1', name: 'Direct Report 1', email: 'report1@example.com' },
    ]);

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /My Tickets ✓/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^My Group/i })).toBeInTheDocument();
    });
  });

  it('toggles My Group filter when clicked and requests tickets with myGroup: true and myTickets: false', async () => {
    vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([
      { id: 'user-report-1', name: 'Direct Report 1', email: 'report1@example.com' },
    ]);

    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^My Group/i })).toBeInTheDocument();
    });

    const myGroupBtn = screen.getByRole('button', { name: /^My Group/i });
    fireEvent.click(myGroupBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /My Group ✓/i })).toBeInTheDocument();
      expect(screen.getByText(/Viewing: My Group \(1 direct report\)/i)).toBeInTheDocument();
      expect(fetchTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          myGroup: true,
          myTickets: false,
        })
      );
    });
  });

  it('switches between My Group and My Tickets without disrupting workflow', async () => {
    vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([
      { id: 'user-report-1', name: 'Direct Report 1' },
      { id: 'user-report-2', name: 'Direct Report 2' },
    ]);

    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^My Group/i })).toBeInTheDocument();
    });

    // 1. Click My Group
    fireEvent.click(screen.getByRole('button', { name: /^My Group/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /My Group ✓/i })).toBeInTheDocument();
    });

    // 2. Click My Tickets
    fireEvent.click(screen.getByRole('button', { name: /^My Tickets/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /My Tickets ✓/i })).toBeInTheDocument();
      expect(fetchTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          myGroup: false,
          myTickets: true,
        })
      );
    });
  });

  it('restores My Group filter from URL query parameter', async () => {
    vi.mocked(ticketService.getMyGroupMembers).mockResolvedValue([
      { id: 'user-report-1', name: 'Direct Report 1' },
    ]);

    const fetchTicketsMock = vi.fn();
    useTicketStore.setState({
      fetchTickets: fetchTicketsMock,
    });

    render(
      <MemoryRouter initialEntries={['/tickets?myGroup=true']}>
        <TicketListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /My Group ✓/i })).toBeInTheDocument();
      expect(fetchTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          myGroup: true,
          myTickets: false,
        })
      );
    });
  });
});

describe('TicketListPage - Holiday Calendar Management (Admin Only)', () => {
  it('hides Manage Holidays button for non-admin users', async () => {
    useAuthStore.setState({
      user: { id: 'u-dev', name: 'Developer', role: { name: 'Developer' } } as any,
    });

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('manage-holidays-btn')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage Holidays/i })).not.toBeInTheDocument();
  });

  it('displays Manage Holidays button for Super Admin and allows marking/unmarking holidays while keeping Sundays as default holidays', async () => {
    useAuthStore.setState({
      user: { id: 'super_admin_01', name: 'Super Admin', type: 'super_admin', role: { name: 'Super Admin' } } as any,
    });

    // Pick a Monday and a Sunday in the current month
    const startOfMonth = dayjs().startOf('month');
    let firstSunday = startOfMonth;
    while (firstSunday.day() !== 0) {
      firstSunday = firstSunday.add(1, 'day');
    }
    let firstMonday = startOfMonth;
    while (firstMonday.day() !== 1) {
      firstMonday = firstMonday.add(1, 'day');
    }
    const sundayStr = firstSunday.format('YYYY-MM-DD');
    const mondayStr = firstMonday.format('YYYY-MM-DD');

    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>,
    );

    const manageBtn = screen.getByTestId('manage-holidays-btn');
    expect(manageBtn).toBeInTheDocument();

    fireEvent.click(manageBtn);

    await waitFor(() => {
      expect(screen.getByText('Manage Escalation Holidays')).toBeInTheDocument();
      expect(screen.getByTestId('legend-sunday')).toBeInTheDocument();
      expect(screen.getByTestId('legend-admin-holiday')).toBeInTheDocument();
      expect(screen.getByTestId('legend-working-day')).toBeInTheDocument();
    });

    // Verify Sunday is marked as default holiday and clicking it does NOT call addHoliday or removeHoliday
    const sundayCell = screen.getByTestId(`calendar-day-${sundayStr}`);
    expect(sundayCell).toHaveAttribute('data-day-type', 'sunday');
    fireEvent.click(sundayCell);
    expect(ticketService.addHoliday).not.toHaveBeenCalled();
    expect(ticketService.removeHoliday).not.toHaveBeenCalled();

    // Verify Monday is a regular working day initially, and clicking it marks it as an admin-designated holiday
    const mondayCell = screen.getByTestId(`calendar-day-${mondayStr}`);
    expect(mondayCell).toHaveAttribute('data-day-type', 'working');

    fireEvent.click(mondayCell);

    await waitFor(() => {
      expect(ticketService.addHoliday).toHaveBeenCalledWith({ date: mondayStr });
      expect(screen.getByTestId(`calendar-day-${mondayStr}`)).toHaveAttribute('data-day-type', 'holiday');
    });

    // Clicking the marked Monday again removes the holiday designation
    fireEvent.click(screen.getByTestId(`calendar-day-${mondayStr}`));

    await waitFor(() => {
      expect(ticketService.removeHoliday).toHaveBeenCalledWith(mondayStr);
      expect(screen.getByTestId(`calendar-day-${mondayStr}`)).toHaveAttribute('data-day-type', 'working');
    });
  });
});


