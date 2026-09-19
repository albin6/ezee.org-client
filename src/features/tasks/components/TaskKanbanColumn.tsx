import React from 'react';
import { Badge } from 'antd';
import { useDroppable } from '@dnd-kit/core';
import { TaskKanbanCard } from './TaskKanbanCard';

interface TaskKanbanColumnProps {
  status: string;
  title: string;
  color: string;
  accentBg: string;
  icon?: React.ReactNode;
  tasks: any[];
  currentUserId?: string;
  isSuperAdmin?: boolean;
  actionLoadingId: string | null;
  onStatusChange: (task: any, newStatus: string, assigneeId?: string) => Promise<void>;
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => Promise<void>;
}

export const TaskKanbanColumn: React.FC<TaskKanbanColumnProps> = ({
  status,
  title,
  color,
  accentBg,
  icon,
  tasks,
  currentUserId,
  isSuperAdmin = false,
  actionLoadingId,
  onStatusChange,
  onEdit,
  onDelete,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl transition-all duration-200 min-w-[280px] max-w-[320px] sm:w-[300px] shrink-0 border ${
        isOver
          ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-300/40'
          : 'bg-gray-50/80 border-gray-200/80 hover:border-gray-300'
      }`}
      style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-gray-200/70 flex items-center justify-between gap-2 bg-white/70 backdrop-blur-xs rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          {icon && <span className="text-gray-500 text-xs shrink-0">{icon}</span>}
          <h3 className="text-xs sm:text-sm font-bold text-gray-800 tracking-tight truncate m-0">
            {title}
          </h3>
        </div>

        <Badge
          count={tasks.length}
          overflowCount={999}
          style={{
            backgroundColor: tasks.length > 0 ? accentBg : '#9ca3af',
            color: tasks.length > 0 ? color : '#ffffff',
            boxShadow: 'none',
            fontSize: '11px',
            fontWeight: 700,
          }}
        />
      </div>

      {/* Cards Container with smooth vertical scrolling */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        {tasks.map((taskItem) => (
          <TaskKanbanCard
            key={taskItem.kanbanCardId || taskItem.id}
            task={taskItem}
            targetAssignee={taskItem.targetAssignee}
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
            actionLoadingId={actionLoadingId}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}

        {tasks.length === 0 && (
          <div
            className={`h-28 rounded-xl border border-dashed flex flex-col items-center justify-center p-3 text-center transition-colors ${
              isOver
                ? 'border-blue-400 bg-blue-50/60 text-blue-600'
                : 'border-gray-200/80 bg-white/40 text-gray-400'
            }`}
          >
            <span className="text-xs font-medium">
              {isOver ? 'Drop task here' : 'No tasks'}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5">
              {isOver ? `Move to ${title}` : `in ${title}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
