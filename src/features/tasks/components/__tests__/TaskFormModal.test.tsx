import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskFormModal } from '../TaskFormModal';
import { useUserStore } from '@/features/users/store/user.store';

// Mock matchMedia for Ant Design in jsdom
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
    users: [
      { id: 'user-id-1', name: 'Alice Smith', email: 'alice@example.com', status: 'ACTIVE', roleId: 'r1', designation: 'Developer', createdAt: '', updatedAt: '' },
      { id: 'user-id-2', name: 'Bob Jones', email: 'bob@example.com', status: 'ACTIVE', roleId: 'r2', designation: 'QA Lead', createdAt: '', updatedAt: '' },
      { id: '43dc96b2-729e-475a-b968-f583c7690f9b', name: 'Athul User', email: 'athul@example.com', status: 'ACTIVE', roleId: 'r3', designation: 'Engineer', createdAt: '', updatedAt: '' },
    ],
  });
});

describe('TaskFormModal Assignee Name Resolution', () => {
  const mockTeamMembers = [
    {
      userId: 'user-id-1',
      user: { id: 'user-id-1', name: 'Alice Smith' },
      role: { name: 'Developer', level: 2 },
    },
    {
      userId: 'user-id-2',
      user: { id: 'user-id-2', name: 'Bob Jones' },
      role: { name: 'QA Lead', level: 2 },
    },
    {
      userId: '43dc96b2-729e-475a-b968-f583c7690f9b',
      user: { id: '43dc96b2-729e-475a-b968-f583c7690f9b', name: 'Athul User' },
      role: { name: 'Engineer', level: 3 },
    },
  ];

  it('displays the assignee name and NOT the raw UUID when editing an existing task with one assignee', async () => {
    const rawUuid = '43dc96b2-729e-475a-b968-f583c7690f9b';
    const task = {
      id: 'task-101',
      title: 'Review analysis - 3 tldv',
      description: 'Task description',
      priority: 'MEDIUM',
      completionType: 'INDIVIDUAL',
      deadline: '2026-09-15T00:00:00.000Z',
      assignees: [
        {
          taskId: 'task-101',
          userId: rawUuid,
          status: 'TODO',
          user: {
            id: rawUuid,
            name: 'Athul User',
          },
        },
      ],
    };

    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskFormModal
        open={true}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        initialValues={task}
        teamMembers={mockTeamMembers}
        currentUserLevel={0}
      />
    );

    // Modal title indicates Edit Task
    expect(screen.getByText('Edit Task')).toBeInTheDocument();

    // The assignee name should be visible in the UI
    expect(screen.getByText('Athul User')).toBeInTheDocument();

    // The raw UUID should NOT be visible anywhere in the document text
    expect(screen.queryByText(rawUuid)).not.toBeInTheDocument();
  });

  it('displays each assignee name for multiple assignees without showing any UUIDs', async () => {
    const uuid1 = 'user-id-1';
    const uuid2 = 'user-id-2';
    const task = {
      id: 'task-102',
      title: 'Multi-assignee task',
      description: 'Desc',
      priority: 'HIGH',
      completionType: 'INDIVIDUAL',
      deadline: '2026-09-20T00:00:00.000Z',
      assignees: [
        {
          userId: uuid1,
          user: { id: uuid1, name: 'Alice Smith' },
        },
        {
          userId: uuid2,
          user: { id: uuid2, name: 'Bob Jones' },
        },
      ],
    };

    render(
      <TaskFormModal
        open={true}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={task}
        teamMembers={mockTeamMembers}
        currentUserLevel={0}
      />
    );

    // Both names should be rendered
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();

    // Neither UUID should be rendered
    expect(screen.queryByText(uuid1)).not.toBeInTheDocument();
    expect(screen.queryByText(uuid2)).not.toBeInTheDocument();
  });

  it('submits the form with underlying assignee IDs unchanged', async () => {
    const rawUuid = '43dc96b2-729e-475a-b968-f583c7690f9b';
    const task = {
      id: 'task-103',
      title: 'Task to update',
      description: 'Desc',
      priority: 'LOW',
      completionType: 'SHARED',
      deadline: '2026-09-25T00:00:00.000Z',
      assignees: [
        {
          userId: rawUuid,
          user: { id: rawUuid, name: 'Athul User' },
        },
      ],
    };

    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskFormModal
        open={true}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        initialValues={task}
        teamMembers={mockTeamMembers}
        currentUserLevel={0}
      />
    );

    // Click submit button (Update Task)
    const updateBtn = screen.getByRole('button', { name: 'Update Task' });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedValues = onSubmit.mock.calls[0][0];
    expect(submittedValues.title).toBe('Task to update');
    // Ensure the ID array is passed to API unchanged
    expect(submittedValues.assigneeIds).toEqual([rawUuid]);
  });

  it('resolves assignee names from useUserStore when assignees are passed as raw IDs or objects without user.name', async () => {
    const rawUuid = '43dc96b2-729e-475a-b968-f583c7690f9b';
    const task = {
      id: 'task-104',
      title: 'Task with plain ID in assignees',
      assignees: [{ userId: rawUuid }],
      deadline: '2026-09-30T00:00:00.000Z',
    };

    render(
      <TaskFormModal
        open={true}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={task}
        teamMembers={[]} // Empty team members to test store resolution
        currentUserLevel={0}
      />
    );

    // Should resolve 'Athul User' from useUserStore
    expect(screen.getByText('Athul User')).toBeInTheDocument();
    expect(screen.queryByText(rawUuid)).not.toBeInTheDocument();
  });

  it('correctly updates and resets when reopening the modal with different tasks', async () => {
    const rawUuid = '43dc96b2-729e-475a-b968-f583c7690f9b';
    const task1 = {
      id: 'task-1',
      title: 'Task 1',
      assignees: [{ userId: rawUuid, user: { id: rawUuid, name: 'Athul User' } }],
    };

    const task2 = {
      id: 'task-2',
      title: 'Task 2',
      assignees: [{ userId: 'user-id-1', user: { id: 'user-id-1', name: 'Alice Smith' } }],
    };

    const { rerender } = render(
      <TaskFormModal
        open={true}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={task1}
        teamMembers={mockTeamMembers}
        currentUserLevel={0}
      />
    );

    expect(screen.getByText('Athul User')).toBeInTheDocument();

    // Close modal
    rerender(
      <TaskFormModal
        open={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={null}
        teamMembers={mockTeamMembers}
        currentUserLevel={0}
      />
    );

    // Reopen modal with task2
    rerender(
      <TaskFormModal
        open={true}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={task2}
        teamMembers={mockTeamMembers}
        currentUserLevel={0}
      />
    );

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('user-id-1')).not.toBeInTheDocument();
  });
});
