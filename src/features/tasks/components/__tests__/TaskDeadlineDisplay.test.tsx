import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { TaskMobileCard } from '../TaskMobileCard';
import { TaskKanbanCard } from '../TaskKanbanCard';
import { LiveCountdown } from '../LiveCountdown';

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

describe('Task Deadline 12-Hour AM/PM Format Consistency Across Views', () => {
  const morningDeadline = dayjs('2028-10-15').hour(9).minute(30).second(0).toISOString();
  const afternoonDeadline = dayjs('2028-10-15').hour(15).minute(45).second(0).toISOString();

  const mockTaskMorning = {
    id: 'task-1',
    title: 'Morning Deployment Task',
    description: 'Deploy microservice update',
    status: 'TODO',
    priority: 'HIGH',
    completionType: 'INDIVIDUAL',
    createdById: 'user-lead',
    createdBy: { id: 'user-lead', name: 'Lead Dev' },
    deadline: morningDeadline,
    assignees: [
      {
        userId: 'user-dev',
        user: { id: 'user-dev', name: 'Junior Dev' },
        status: 'TODO',
      },
    ],
  };

  const mockTaskAfternoon = {
    id: 'task-2',
    title: 'Afternoon Review Task',
    description: 'Code review session',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    completionType: 'SHARED',
    createdById: 'user-lead',
    createdBy: { id: 'user-lead', name: 'Lead Dev' },
    deadline: afternoonDeadline,
    assignees: [
      {
        userId: 'user-dev',
        user: { id: 'user-dev', name: 'Junior Dev' },
        status: 'IN_PROGRESS',
      },
    ],
  };

  describe('TaskMobileCard', () => {
    it('displays morning deadline in 12-hour format with AM', () => {
      render(
        <TaskMobileCard
          task={mockTaskMorning}
          currentUserId="user-dev"
          actionLoadingId={null}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const expectedMorningTime = dayjs(morningDeadline).format('MMM DD, YYYY • hh:mm A');
      expect(screen.getByText(expectedMorningTime)).toBeInTheDocument();
      expect(expectedMorningTime).toContain('AM');
    });

    it('displays afternoon deadline in 12-hour format with PM', () => {
      render(
        <TaskMobileCard
          task={mockTaskAfternoon}
          currentUserId="user-dev"
          actionLoadingId={null}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const expectedAfternoonTime = dayjs(afternoonDeadline).format('MMM DD, YYYY • hh:mm A');
      expect(screen.getByText(expectedAfternoonTime)).toBeInTheDocument();
      expect(expectedAfternoonTime).toContain('PM');
    });

    it('handles tasks with missing deadline gracefully', () => {
      const taskNoDeadline = { ...mockTaskMorning, deadline: null };
      render(
        <TaskMobileCard
          task={taskNoDeadline}
          currentUserId="user-dev"
          actionLoadingId={null}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('No deadline')).toBeInTheDocument();
    });
  });

  describe('TaskKanbanCard', () => {
    it('displays deadline tooltip in 12-hour AM/PM format', () => {
      render(
        <TaskKanbanCard
          task={mockTaskAfternoon}
          currentUserId="user-dev"
          isSuperAdmin={false}
          actionLoadingId={null}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const expectedTooltip = `Deadline: ${dayjs(afternoonDeadline).format('MMM DD, YYYY • hh:mm A')}`;
      const deadlineElement = document.querySelector(`[title="${expectedTooltip}"]`);
      expect(deadlineElement).toBeInTheDocument();
      expect(expectedTooltip).toContain('PM');
    });
  });

  describe('LiveCountdown', () => {
    it('renders countdown clock for valid future deadline', () => {
      const futureDate = new Date(Date.now() + 3600 * 1000 * 5).toISOString();
      const { container } = render(<LiveCountdown deadline={futureDate} />);
      expect(container.textContent).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
    });

    it('gracefully handles missing or invalid deadline strings without throwing', () => {
      const { container: c1 } = render(<LiveCountdown deadline="" />);
      expect(c1.textContent).toBe('-');

      const { container: c2 } = render(<LiveCountdown deadline="invalid-date" />);
      expect(c2.textContent).toBe('-');
    });
  });
});
