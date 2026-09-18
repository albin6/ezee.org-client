import React, { useState, useEffect } from 'react';
import { Spin, message } from 'antd';
import { 
  ClockCircleOutlined, 
  SyncOutlined, 
  CheckCircleOutlined, 
  SafetyCertificateOutlined, 
  CloseCircleOutlined 
} from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { TaskKanbanColumn } from './TaskKanbanColumn';
import { TaskKanbanCard } from './TaskKanbanCard';

interface ColumnDef {
  status: string;
  title: string;
  color: string;
  accentBg: string;
  icon: React.ReactNode;
}

const KANBAN_COLUMNS: ColumnDef[] = [
  {
    status: 'TODO',
    title: 'To Do',
    color: '#64748b',
    accentBg: '#f1f5f9',
    icon: <ClockCircleOutlined />,
  },
  {
    status: 'IN_PROGRESS',
    title: 'In Progress',
    color: '#2563eb',
    accentBg: '#dbeafe',
    icon: <SyncOutlined />,
  },
  {
    status: 'COMPLETED',
    title: 'Completed',
    color: '#d97706',
    accentBg: '#fef3c7',
    icon: <CheckCircleOutlined />,
  },
  {
    status: 'VERIFIED',
    title: 'Verified',
    color: '#16a34a',
    accentBg: '#dcfce7',
    icon: <SafetyCertificateOutlined />,
  },
  {
    status: 'REJECTED',
    title: 'Rejected',
    color: '#dc2626',
    accentBg: '#fee2e2',
    icon: <CloseCircleOutlined />,
  },
];

interface TaskKanbanBoardProps {
  tasks: any[];
  loading: boolean;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  actionLoadingId: string | null;
  onStatusChange: (task: any, newStatus: string) => Promise<void>;
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => Promise<void>;
}

export const TaskKanbanBoard: React.FC<TaskKanbanBoardProps> = ({
  tasks,
  loading,
  currentUserId,
  isSuperAdmin = false,
  actionLoadingId,
  onStatusChange,
  onEdit,
  onDelete,
}) => {
  const [activeTask, setActiveTask] = useState<any | null>(null);
  // Real-time ticker for 15-minute rejection window and 24-hour verification window
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task;
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const task = active.data.current?.task;
    const targetStatus = over.id as string;

    if (!task) return;

    const isAssignor = task.createdById === currentUserId;
    const isAssignorOrAdmin = isAssignor || isSuperAdmin;
    const assigneeRecord = task.assignees?.find(
      (a: any) => (a.userId || a.user?.id) === currentUserId
    );
    const isAssignee = !!assigneeRecord;

    // Helper to determine where the card was located visually
    const rejectedTime = task.rejectedAt ? new Date(task.rejectedAt).getTime() : 0;
    const isWithin15MinRejection = rejectedTime > 0 && (Date.now() - rejectedTime) < 15 * 60 * 1000;
    const isVisuallyRejected = (isWithin15MinRejection && isAssignorOrAdmin) || task.status === 'REJECTED';

    if (targetStatus === 'VERIFIED') {
      if (!isAssignorOrAdmin) {
        message.warning('Only the task assignor or super admin can verify completed tasks.');
        return;
      }
      if (task.status !== 'COMPLETED') {
        message.warning('Only completed tasks can be verified.');
        return;
      }
      await onStatusChange(task, 'VERIFIED');
      return;
    }

    if (targetStatus === 'REJECTED') {
      if (!isAssignorOrAdmin) {
        message.warning('Only the task assignor or super admin can reject a completed task.');
        return;
      }
      if (task.status !== 'COMPLETED') {
        message.warning('Only completed tasks can be rejected for rework.');
        return;
      }
      await onStatusChange(task, 'REJECTED');
      return;
    }

    if (targetStatus === 'IN_PROGRESS') {
      if (isVisuallyRejected) {
        // Dragging out of Rejected into In Progress
        await onStatusChange(task, 'IN_PROGRESS');
        return;
      }
      if (task.status === 'TODO') {
        if (!isAssignee && !isAssignorOrAdmin) {
          message.warning('Only assignees or assignor can start a task.');
          return;
        }
        await onStatusChange(task, 'IN_PROGRESS');
        return;
      }
      if (task.status === 'IN_PROGRESS') return;
    }

    if (targetStatus === 'COMPLETED') {
      if (task.status !== 'IN_PROGRESS') {
        message.warning('Tasks must be In Progress before they can be completed.');
        return;
      }
      if (!isAssignee && !isAssignorOrAdmin) {
        message.warning('Only assignees or assignor can complete this task.');
        return;
      }
      await onStatusChange(task, 'COMPLETED');
      return;
    }

    if (targetStatus === 'TODO') {
      message.warning('Tasks in progress or completed cannot return to To Do.');
      return;
    }
  };

  if (loading && (!tasks || tasks.length === 0)) {
    return (
      <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-gray-100">
        <Spin size="large" />
      </div>
    );
  }

  // Group tasks into the 5 core workflow columns: To Do, In Progress, Completed, Verified, Rejected
  const tasksByStatus: Record<string, any[]> = {
    TODO: [],
    IN_PROGRESS: [],
    COMPLETED: [],
    VERIFIED: [],
    REJECTED: [],
  };

  const now = Date.now();

  tasks.forEach((task) => {
    const isAssignor = task.createdById === currentUserId;
    const isAssignorOrAdmin = isAssignor || isSuperAdmin;

    // 1. VERIFIED COLUMN (disappears after 24 hours)
    if (task.status === 'VERIFIED') {
      const verifiedTimestamp = task.verifiedAt 
        ? new Date(task.verifiedAt).getTime() 
        : new Date(task.updatedAt || task.createdAt).getTime();
      
      const isPast24Hours = (now - verifiedTimestamp) >= 24 * 60 * 60 * 1000;
      if (!isPast24Hours) {
        tasksByStatus.VERIFIED.push(task);
      }
      return;
    }

    // Check individual assignee status if applicable
    let effectiveStatus = task.status;
    if (task.completionType === 'INDIVIDUAL') {
      const myRecord = task.assignees?.find(
        (a: any) => (a.userId || a.user?.id) === currentUserId
      );
      if (myRecord?.status) {
        effectiveStatus = myRecord.status;
      }
    }

    // 2. REJECTION 15-MINUTE VISIBILITY LOGIC
    // Rejection sends task back to IN_PROGRESS.
    // On assignor/admin side: appears in REJECTED column for 15 minutes.
    // On assignee side: immediately appears in IN_PROGRESS column.
    const rejectedTimestamp = task.rejectedAt ? new Date(task.rejectedAt).getTime() : 0;
    const isWithin15MinRejection = rejectedTimestamp > 0 && (now - rejectedTimestamp) < 15 * 60 * 1000;

    if (isWithin15MinRejection) {
      if (isAssignorOrAdmin) {
        // Assignor View: Show in Rejected column for 15 minutes
        tasksByStatus.REJECTED.push(task);
        return;
      } else {
        // Assignee View: Immediately returns to In Progress for rework
        tasksByStatus.IN_PROGRESS.push(task);
        return;
      }
    }

    // 3. Fallback for legacy tasks explicitly saved with status REJECTED
    if (task.status === 'REJECTED') {
      if (isAssignorOrAdmin) {
        tasksByStatus.REJECTED.push(task);
      } else {
        tasksByStatus.IN_PROGRESS.push(task);
      }
      return;
    }

    // 4. Standard workflow placement
    if (effectiveStatus === 'COMPLETED' || task.status === 'COMPLETED') {
      tasksByStatus.COMPLETED.push(task);
    } else if (effectiveStatus === 'IN_PROGRESS' || task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW') {
      tasksByStatus.IN_PROGRESS.push(task);
    } else {
      tasksByStatus.TODO.push(task);
    }
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full">
        {/* Kanban Board Container with horizontal scroll */}
        <div className="flex items-start gap-3.5 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {KANBAN_COLUMNS.map((col) => (
            <TaskKanbanColumn
              key={col.status}
              status={col.status}
              title={col.title}
              color={col.color}
              accentBg={col.accentBg}
              icon={col.icon}
              tasks={tasksByStatus[col.status] || []}
              currentUserId={currentUserId}
              isSuperAdmin={isSuperAdmin}
              actionLoadingId={actionLoadingId}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay for smooth preview while dragging */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask ? (
          <div className="w-[280px]">
            <TaskKanbanCard
              task={activeTask}
              currentUserId={currentUserId}
              isSuperAdmin={isSuperAdmin}
              actionLoadingId={null}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
