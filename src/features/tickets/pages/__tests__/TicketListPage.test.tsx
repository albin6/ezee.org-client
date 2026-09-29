import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
