import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../../store/ticket.store';
import { useUserStore } from '@/features/users/store/user.store';

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

