import React from 'react';
import { Card, Tag, Button, Popconfirm, Tooltip, Avatar, Popover } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  ClockCircleOutlined, 
  TeamOutlined, 
  SyncOutlined,
  HolderOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { LiveCountdown } from './LiveCountdown';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'green',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'default',
  IN_PROGRESS: 'blue',
  IN_REVIEW: 'purple',
  COMPLETED: 'gold',
  VERIFIED: 'green',
  REJECTED: 'red',
  CANCELLED: 'default',
};

interface TaskKanbanCardProps {
  task: any;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  actionLoadingId: string | null;
  onStatusChange: (task: any, newStatus: string) => Promise<void>;
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => Promise<void>;
  isOverlay?: boolean;
}

export const TaskKanbanCard: React.FC<TaskKanbanCardProps> = ({
  task,
  currentUserId,
  isSuperAdmin = false,
  actionLoadingId,
  onStatusChange,
  onEdit,
  onDelete,
  isOverlay = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.35 : 1,
    cursor: isOverlay ? 'grabbing' : 'grab',
  };

  const isAssignor = task.createdById === currentUserId;
  const isAssignorOrAdmin = isAssignor || isSuperAdmin;
  const assigneeRecord = task.assignees?.find(
    (a: any) => (a.userId || a.user?.id) === currentUserId
  );
  const isAssignee = !!assigneeRecord;

  // Determine effective display status
  let displayStatus = task.status;
  if (task.completionType === 'INDIVIDUAL' && isAssignee) {
    displayStatus = assigneeRecord.status;
  }

  // Rejection timing calculation (15-minute window)
  const rejectedTime = task.rejectedAt ? new Date(task.rejectedAt).getTime() : 0;
  const msSinceRejection = Date.now() - rejectedTime;
  const isWithin15MinRejection = rejectedTime > 0 && msSinceRejection < 15 * 60 * 1000;
  const rejectionRemainingMs = Math.max(0, 15 * 60 * 1000 - msSinceRejection);

  const formatRejectionCountdown = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Verified timing calculation (24-hour window)
  const verifiedTime = task.verifiedAt 
    ? new Date(task.verifiedAt).getTime() 
    : new Date(task.updatedAt || task.createdAt).getTime();
  const msSinceVerification = Date.now() - verifiedTime;
  const isVerified = task.status === 'VERIFIED';
  const verifiedRemainingMs = Math.max(0, 24 * 60 * 60 * 1000 - msSinceVerification);
  const verifiedHoursRemaining = Math.floor(verifiedRemainingMs / (1000 * 60 * 60));
  const verifiedMinsRemaining = Math.floor((verifiedRemainingMs % (1000 * 60 * 60)) / (1000 * 60));

  const assignees = task.assignees || [];
  const completedAssigneesCount =
    task.completionType === 'INDIVIDUAL' && assignees.length > 0
      ? assignees.filter((a: any) => a.status === 'COMPLETED' || a.status === 'VERIFIED').length
      : 0;

  const canEditOrDelete = isAssignor || isSuperAdmin;
  const assignorName = task.createdBy?.name || 'Assignor';
  const assignorInitial = assignorName.charAt(0).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative group bg-white rounded-xl border transition-all duration-150 ${
        isOverlay
          ? 'shadow-xl border-blue-400 rotate-1 scale-102 cursor-grabbing'
          : isDragging
          ? 'border-dashed border-gray-300 shadow-none'
          : 'border-gray-200/90 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <Card
        className="rounded-xl overflow-hidden border-0 bg-transparent"
        styles={{ body: { padding: '12px 14px' } }}
      >
        {/* Rejection Notification Banner for Assignor (when inside 15-minute rejection window) */}
        {isWithin15MinRejection && isAssignorOrAdmin && (
          <div className="mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1">
              <CloseCircleOutlined className="text-red-500 text-xs" />
              Rejected (Rework)
            </span>
            <span className="font-mono text-[10px] font-bold text-red-600">
              {formatRejectionCountdown(rejectionRemainingMs)} left
            </span>
          </div>
        )}

        {/* Rework Banner for Assignee (when task was recently rejected and returned to In Progress) */}
        {isWithin15MinRejection && isAssignee && (
          <div className="mb-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1">
              <SyncOutlined spin className="text-amber-600 text-xs" />
              Rework Required
            </span>
            <span className="text-[10px] text-amber-700 font-medium">
              Returned by Assignor
            </span>
          </div>
        )}

        {/* Verified Disappearance Notice (in Verified Column) */}
        {isVerified && (
          <div className="mb-2 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-[10px] text-green-700 flex items-center justify-between">
            <span className="font-medium flex items-center gap-1">
              <SafetyCertificateOutlined className="text-green-600 text-xs" />
              Verified
            </span>
            <span className="text-[10px] text-green-600">
              Disappears in {verifiedHoursRemaining}h {verifiedMinsRemaining}m
            </span>
          </div>
        )}

        {/* Card Header: Priority, Type Badges & Actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Drag Handle Indicator */}
            <div
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-gray-400 hover:text-gray-700 transition-colors"
              title="Drag to change status"
            >
              <HolderOutlined className="text-xs" />
            </div>

            <Tag
              color={PRIORITY_COLORS[task.priority] || 'default'}
              className="m-0 text-[10px] font-semibold px-1.5 py-0 leading-tight rounded"
            >
              {task.priority}
            </Tag>

            <Tag
              color={task.completionType === 'INDIVIDUAL' ? 'purple' : 'geekblue'}
              className="m-0 text-[10px] font-medium px-1.5 py-0 leading-tight rounded"
            >
              {task.completionType === 'INDIVIDUAL' ? 'Individual' : 'Shared'}
            </Tag>

            {task.recurrencePattern && (
              <Tag
                icon={<SyncOutlined className="text-[9px]" />}
                className="m-0 text-[10px] text-gray-500 bg-gray-50 px-1 py-0 rounded"
              >
                {task.recurrencePattern}
              </Tag>
            )}
          </div>

          {canEditOrDelete && !isOverlay && (
            <div
              className="flex items-center gap-0.5 shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Button
                type="text"
                size="small"
                icon={<EditOutlined className="text-gray-400 hover:text-blue-600 text-xs" />}
                className="w-6 h-6 flex items-center justify-center p-0 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                title="Edit task"
              />
              <Popconfirm
                title="Delete Task"
                description="Are you sure you want to delete this task?"
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  onDelete(task.id);
                }}
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined className="text-xs" />}
                  className="w-6 h-6 flex items-center justify-center p-0 rounded"
                  onClick={(e) => e.stopPropagation()}
                  title="Delete task"
                />
              </Popconfirm>
            </div>
          )}
        </div>

        {/* Task Title & Description */}
        <div className="mb-3">
          <h4 className="font-semibold text-gray-900 text-sm leading-snug break-words">
            {task.title}
          </h4>
          {task.description && (
            <Tooltip title={task.description} placement="topLeft">
              <p className="text-xs text-gray-500 line-clamp-2 mt-1 mb-0 cursor-help">
                {task.description}
              </p>
            </Tooltip>
          )}
        </div>

        {/* Assignees & Status Section */}
        <div className="bg-gray-50/90 rounded-lg p-2 border border-gray-200/50 mb-3 space-y-1.5">
          <div className="flex items-center justify-between gap-1 pb-1 border-b border-gray-200/40">
            <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
              <TeamOutlined className="text-gray-400 text-[10px]" />
              <span>Assignees</span>
            </span>
            {task.completionType === 'INDIVIDUAL' ? (
              <span className="text-[10px] font-semibold text-gray-600">
                {completedAssigneesCount}/{assignees.length} done
              </span>
            ) : (
              <span className="text-[10px] text-gray-400">
                {assignees.length} assigned
              </span>
            )}
          </div>

          <div className="space-y-1">
            {assignees.slice(0, 2).map((a: any) => {
              const isMe = (a.userId || a.user?.id) === currentUserId;
              const status = a.status || task.status;
              const name = a.user?.name || 'User';
              return (
                <div key={a.userId || a.id} className="flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1 min-w-0">
                    <Avatar size={18} className="bg-blue-100 text-blue-700 font-bold text-[9px] shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </Avatar>
                    <span className={`text-[11px] truncate max-w-[100px] ${isMe ? 'text-blue-700 font-semibold' : 'text-gray-700 font-medium'}`}>
                      {name} {isMe && '(You)'}
                    </span>
                  </div>
                  <Tag color={STATUS_COLORS[status] || 'default'} className="m-0 text-[9px] py-0 px-1 font-medium shrink-0">
                    {status}
                  </Tag>
                </div>
              );
            })}

            {assignees.length > 2 && (
              <Popover
                title="All Assignees"
                content={
                  <div className="space-y-1 min-w-[180px]">
                    {assignees.map((a: any) => (
                      <div key={a.userId || a.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                        <span className="font-medium text-gray-800">{a.user?.name || 'User'}</span>
                        <Tag color={STATUS_COLORS[a.status || task.status] || 'default'} className="m-0 text-[10px]">
                          {a.status || task.status}
                        </Tag>
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="text-[10px] text-blue-600 hover:underline cursor-pointer font-medium block pt-0.5">
                  +{assignees.length - 2} more assignees...
                </span>
              </Popover>
            )}

            {assignees.length === 0 && (
              <span className="text-gray-400 italic text-[10px]">Unassigned</span>
            )}
          </div>
        </div>

        {/* Card Footer: Assignor & Deadline Countdown */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
          {/* Assignor */}
          <div className="flex items-center gap-1.5 min-w-0" title={`Created by ${assignorName}`}>
            <Avatar size={20} className="bg-purple-100 text-purple-700 font-semibold text-[10px] shrink-0">
              {assignorInitial}
            </Avatar>
            <span className="text-[11px] text-gray-500 truncate max-w-[70px]">
              {assignorName}
            </span>
          </div>

          {/* Deadline & LiveCountdown */}
          <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-gray-700 bg-gray-100/90 px-1.5 py-0.5 rounded border border-gray-200/60">
            <ClockCircleOutlined className="text-gray-400 text-[10px]" />
            <LiveCountdown deadline={task.deadline} />
          </div>
        </div>

        {/* Quick Action Transition Buttons */}
        {!isOverlay && (
          <div
            className="mt-2.5 pt-2 border-t border-gray-100/80"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Assignee: Start Work from TODO */}
            {isAssignee && displayStatus === 'TODO' && (
              <Button
                size="small"
                type="primary"
                loading={actionLoadingId === `${task.id}-IN_PROGRESS`}
                disabled={!!actionLoadingId}
                className="w-full text-xs font-medium"
                onClick={() => onStatusChange(task, 'IN_PROGRESS')}
              >
                Start Work
              </Button>
            )}

            {/* Assignee: Complete Task when IN_PROGRESS */}
            {isAssignee && (displayStatus === 'IN_PROGRESS' || (task.status === 'IN_PROGRESS' && task.completionType !== 'INDIVIDUAL')) && (
              <Button
                size="small"
                type="primary"
                loading={actionLoadingId === `${task.id}-COMPLETED`}
                disabled={!!actionLoadingId}
                className="w-full bg-blue-600 hover:bg-blue-500 text-xs font-medium"
                onClick={() => onStatusChange(task, 'COMPLETED')}
              >
                Complete Task
              </Button>
            )}

            {/* Assignor / Super Admin: Verify or Reject COMPLETED tasks */}
            {isAssignorOrAdmin && task.status === 'COMPLETED' && (
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="small"
                  type="primary"
                  loading={actionLoadingId === `${task.id}-VERIFIED`}
                  disabled={!!actionLoadingId}
                  className="bg-green-600 hover:bg-green-500 text-xs font-medium"
                  onClick={() => onStatusChange(task, 'VERIFIED')}
                >
                  Verify
                </Button>
                <Button
                  size="small"
                  danger
                  loading={actionLoadingId === `${task.id}-REJECTED`}
                  disabled={!!actionLoadingId}
                  className="text-xs font-medium"
                  onClick={() => onStatusChange(task, 'REJECTED')}
                >
                  Reject
                </Button>
              </div>
            )}

            {/* Assignor: Fast shortcut to move to In Progress from Rejected column */}
            {isAssignorOrAdmin && isWithin15MinRejection && (
              <Button
                size="small"
                type="default"
                loading={actionLoadingId === `${task.id}-IN_PROGRESS`}
                disabled={!!actionLoadingId}
                className="w-full text-xs font-medium text-gray-700 hover:text-blue-600 mt-1"
                onClick={() => onStatusChange(task, 'IN_PROGRESS')}
              >
                Move to In Progress
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
