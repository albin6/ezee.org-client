import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TaskDashboardPage } from '../TaskDashboardPage';
import { taskApi } from '../../api/task.api';
import { useAuthStore } from '@/features/auth/store/auth.store';

// Mock ResizeObserver for Recharts ResponsiveContainer
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock('@/features/teams/api/team.service', () => ({
  teamService: {
    getTeams: vi.fn().mockResolvedValue({
      data: [{ id: 'team-alpha', name: 'Alpha Team' }],
    }),
  },
}));

vi.mock('../../api/task.api', () => ({
  taskApi: {
    getDashboardMetrics: vi.fn(),
    getMyGroupMembers: vi.fn(),
  },
}));

describe('TaskDashboardPage — Personal & Reporting Officer Group Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only personal task metrics for a regular user and hides the My Group switcher', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-regular-1',
        name: 'Regular Employee',
        email: 'employee@ezee.org',
        type: 'user',
        role: { id: 'role-dev', name: 'Developer' },
      } as any,
      isAuthenticated: true,
    });

    (taskApi.getDashboardMetrics as any).mockResolvedValue({
      scope: 'my_tasks',
      isReportingOfficer: false,
      canViewGroup: false,
      groupMembers: [],
      summary: {
        total: 6,
        pending: 2,
        inProgress: 1,
        active: 3,
        completed: 3,
        overdue: 1,
        approaching: 2,
        blocked: 0,
      },
      statusDistribution: [
        { status: 'TODO', count: 2 },
        { status: 'IN_PROGRESS', count: 1 },
        { status: 'COMPLETED', count: 3 },
      ],
      priorityDistribution: [
        { priority: 'HIGH', count: 3 },
        { priority: 'MEDIUM', count: 3 },
      ],
      workload: [
        {
          userId: 'user-regular-1',
          userName: 'Regular Employee',
          totalTasks: 6,
          pendingTasks: 2,
          inProgressTasks: 1,
          activeTasks: 3,
          completedTasks: 3,
          overdueTasks: 1,
          approachingTasks: 2,
          completionRate: 50,
        },
      ],
      overdue: [
        {
          id: 'task-od-1',
          title: 'Submit Weekly Report',
          priority: 'HIGH',
          deadline: '2026-10-10T14:30:00.000Z',
          assignees: [{ userId: 'user-regular-1', user: { id: 'user-regular-1', name: 'Regular Employee' } }],
        },
      ],
      upcoming: [
        {
          id: 'task-up-1',
          title: 'Client Demo Prep',
          priority: 'MEDIUM',
          deadline: '2026-10-20T09:15:00.000Z',
          assignees: [{ userId: 'user-regular-1', user: { id: 'user-regular-1', name: 'Regular Employee' } }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <TaskDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(taskApi.getDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'my_tasks' })
      );
    });

    expect(screen.getByTestId('dashboard-scope-badge')).toHaveTextContent('Viewing: My Tasks');
    expect(screen.queryByTestId('dashboard-scope-switcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('group-member-breakdown-card')).not.toBeInTheDocument();

    // Verify KPI summary cards
    expect(within(screen.getByTestId('kpi-total-tasks')).getByText('6')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-pending-tasks')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-in-progress-tasks')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-completed-tasks')).getByText('3')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-overdue-tasks')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-approaching-tasks')).getByText('2')).toBeInTheDocument();
  });

  it('allows a reporting officer to toggle between My Tasks and My Group and inspect member breakdown', async () => {
    useAuthStore.setState({
      user: {
        id: 'officer-1',
        name: 'Sarah Lead',
        email: 'sarah@ezee.org',
        type: 'user',
        role: { id: 'role-lead', name: 'Team Lead' },
      } as any,
      isAuthenticated: true,
    });

    const mockGroupMembers = [
      {
        id: 'dev-1',
        name: 'Alice Developer',
        email: 'alice@ezee.org',
        designation: 'Frontend Engineer',
        roleName: 'Developer',
        teams: [{ id: 'team-alpha', name: 'Alpha Team' }],
      },
      {
        id: 'dev-2',
        name: 'Bob Tester',
        email: 'bob@ezee.org',
        designation: 'QA Engineer',
        roleName: 'QA',
        teams: [{ id: 'team-alpha', name: 'Alpha Team' }],
      },
    ];

    (taskApi.getDashboardMetrics as any).mockImplementation(async (params: any) => {
      if (params?.scope === 'my_group') {
        return {
          scope: 'my_group',
          isReportingOfficer: true,
          canViewGroup: true,
          groupMembers: mockGroupMembers,
          authorizedTeams: [{ id: 'team-alpha', name: 'Alpha Team' }],
          summary: {
            total: 9,
            pending: 3,
            inProgress: 2,
            active: 5,
            completed: 4,
            overdue: 1,
            approaching: 4,
            blocked: 0,
          },
          statusDistribution: [
            { status: 'TODO', count: 3 },
            { status: 'IN_PROGRESS', count: 2 },
            { status: 'COMPLETED', count: 4 },
          ],
          priorityDistribution: [{ priority: 'HIGH', count: 5 }, { priority: 'LOW', count: 4 }],
          workload: [
            {
              userId: 'dev-1',
              userName: 'Alice Developer',
              designation: 'Frontend Engineer',
              roleName: 'Developer',
              totalTasks: 5,
              pendingTasks: 1,
              inProgressTasks: 1,
              activeTasks: 2,
              completedTasks: 3,
              overdueTasks: 0,
              approachingTasks: 2,
              completionRate: 60,
            },
            {
              userId: 'dev-2',
              userName: 'Bob Tester',
              designation: 'QA Engineer',
              roleName: 'QA',
              totalTasks: 4,
              pendingTasks: 2,
              inProgressTasks: 1,
              activeTasks: 3,
              completedTasks: 1,
              overdueTasks: 1,
              approachingTasks: 2,
              completionRate: 25,
            },
          ],
          memberBreakdown: [
            {
              userId: 'dev-1',
              userName: 'Alice Developer',
              designation: 'Frontend Engineer',
              roleName: 'Developer',
              totalTasks: 5,
              pendingTasks: 1,
              inProgressTasks: 1,
              activeTasks: 2,
              completedTasks: 3,
              overdueTasks: 0,
              approachingTasks: 2,
              completionRate: 60,
            },
            {
              userId: 'dev-2',
              userName: 'Bob Tester',
              designation: 'QA Engineer',
              roleName: 'QA',
              totalTasks: 4,
              pendingTasks: 2,
              inProgressTasks: 1,
              activeTasks: 3,
              completedTasks: 1,
              overdueTasks: 1,
              approachingTasks: 2,
              completionRate: 25,
            },
          ],
          overdue: [],
          upcoming: [],
        };
      }

      // Personal tasks for officer-1
      return {
        scope: 'my_tasks',
        isReportingOfficer: true,
        canViewGroup: true,
        groupMembers: mockGroupMembers,
        authorizedTeams: [{ id: 'team-alpha', name: 'Alpha Team' }],
        summary: {
          total: 2,
          pending: 1,
          inProgress: 0,
          active: 1,
          completed: 1,
          overdue: 0,
          approaching: 1,
          blocked: 0,
        },
        statusDistribution: [{ status: 'TODO', count: 1 }, { status: 'COMPLETED', count: 1 }],
        priorityDistribution: [{ priority: 'HIGH', count: 2 }],
        workload: [],
        overdue: [],
        upcoming: [],
      };
    });

    render(
      <MemoryRouter>
        <TaskDashboardPage />
      </MemoryRouter>
    );

    // Initially loads personal tasks (my_tasks)
    await waitFor(() => {
      expect(within(screen.getByTestId('kpi-total-tasks')).getByText('2')).toBeInTheDocument();
    });

    expect(screen.getByTestId('dashboard-scope-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('scope-my-group-btn')).toHaveTextContent('My Group (2)');

    // Switch to My Group view
    fireEvent.click(screen.getByTestId('scope-my-group-btn'));

    await waitFor(() => {
      expect(taskApi.getDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'my_group' })
      );
      expect(within(screen.getByTestId('kpi-total-tasks')).getByText('9')).toBeInTheDocument();
    });

    expect(screen.getByTestId('dashboard-scope-badge')).toHaveTextContent('Viewing: My Group (2 members)');
    expect(screen.getByTestId('group-member-breakdown-card')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Developer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Tester').length).toBeGreaterThan(0);

    // Switch back to My Tasks view
    fireEvent.click(screen.getByTestId('scope-my-tasks-btn'));

    await waitFor(() => {
      expect(within(screen.getByTestId('kpi-total-tasks')).getByText('2')).toBeInTheDocument();
    });
  });
});
