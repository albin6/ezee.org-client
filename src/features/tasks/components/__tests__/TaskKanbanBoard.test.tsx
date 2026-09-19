import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskKanbanBoard } from '../TaskKanbanBoard';

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
});

describe('TaskKanbanBoard - Per-Assignee Individual Task Cards', () => {
  const aliceId = 'user-alice-111';
  const bobId = 'user-bob-222';
  const assignorId = 'user-assignor-000';

  const mockIndividualTask = {
    id: 'task-indiv-1',
    title: 'Individual Multi-Assignee Feature',
    description: 'Each assignee works independently',
    status: 'IN_PROGRESS', // Task status updated when Alice started
    completionType: 'INDIVIDUAL',
    priority: 'HIGH',
    createdById: assignorId,
    createdBy: { id: assignorId, name: 'Project Lead' },
    deadline: new Date(Date.now() + 86400000).toISOString(),
    assignees: [
      {
        userId: aliceId,
        user: { id: aliceId, name: 'Alice' },
        status: 'IN_PROGRESS',
      },
      {
        userId: bobId,
        user: { id: bobId, name: 'Bob' },
        status: 'TODO',
      },
    ],
  };

  it('renders Bob card in To Do column when Bob is logged in (Assigned to Me view)', () => {
    const onStatusChange = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TaskKanbanBoard
        tasks={[mockIndividualTask]}
        loading={false}
        activeFilter="assigned_to_me"
        currentUserId={bobId}
        actionLoadingId={null}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    // Verify Bob sees his card in TODO column
    expect(screen.getByText('Assignee: Bob (You)')).toBeInTheDocument();
    expect(screen.getByText('Start Work')).toBeInTheDocument();
  });

  it('renders distinct sub-cards per assignee on the Assignor board (Assigned by Me view)', () => {
    const onStatusChange = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TaskKanbanBoard
        tasks={[mockIndividualTask]}
        loading={false}
        activeFilter="assigned_by_me"
        currentUserId={assignorId}
        actionLoadingId={null}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    // The assignor should see both Alice's card (In Progress) and Bob's card (To Do)
    expect(screen.getByText('Assignee: Alice')).toBeInTheDocument();
    expect(screen.getByText('Assignee: Bob')).toBeInTheDocument();
  });

  it('triggers onStatusChange with Bob userId when Bob clicks Start Work', () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TaskKanbanBoard
        tasks={[mockIndividualTask]}
        loading={false}
        activeFilter="assigned_to_me"
        currentUserId={bobId}
        actionLoadingId={null}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const startWorkBtn = screen.getByText('Start Work').closest('button')!;
    fireEvent.click(startWorkBtn);

    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-indiv-1' }),
      'IN_PROGRESS',
      bobId
    );
  });
});
