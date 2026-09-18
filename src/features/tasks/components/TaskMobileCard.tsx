import React, { useState } from 'react';
import { Card, Tag, Button, Popconfirm, Space } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  ClockCircleOutlined, 
  CalendarOutlined,
  UserOutlined, 
  TeamOutlined,
  SyncOutlined,
  DownOutlined,
  UpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { LiveCountdown } from './LiveCountdown';

interface TaskMobileCardProps {
  task: any;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  actionLoadingId: string | null;
  onStatusChange: (task: any, newStatus: string) => Promise<void>;
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => Promise<void>;
}

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

export const TaskMobileCard: React.FC<TaskMobileCardProps> = ({
  task,
  currentUserId,
  isSuperAdmin = false,
  actionLoadingId,
  onStatusChange,
  onEdit,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isAssignor = task.createdById === currentUserId;
  const assigneeRecord = task.assignees?.find(
    (a: any) => (a.userId || a.user?.id) === currentUserId
  );
  const isAssignee = !!assigneeRecord;

  // Determine effective status
  let displayStatus = task.status;
  let isIndividualStatus = false;
  if (task.completionType === 'INDIVIDUAL' && isAssignee) {
    displayStatus = assigneeRecord.status;
    isIndividualStatus = true;
  }

  const rejectedTime = task.rejectedAt ? new Date(task.rejectedAt).getTime() : 0;
  const isWithin15MinRejection = rejectedTime > 0 && (Date.now() - rejectedTime) < 15 * 60 * 1000;
  const showAsRejectedForAssignor = isWithin15MinRejection && (isAssignor || isSuperAdmin);

  const completedAssigneesCount =
    task.completionType === 'INDIVIDUAL' && task.assignees
      ? task.assignees.filter(
          (a: any) => a.status === 'COMPLETED' || a.status === 'VERIFIED'
        ).length
      : 0;

  const canEditOrDelete = isAssignor || isSuperAdmin;
  const hasActionButtons =
    (isAssignee && (displayStatus === 'TODO' || displayStatus === 'IN_PROGRESS')) ||
    ((isAssignor || isSuperAdmin) && task.status === 'COMPLETED');

  return (
    <Card 
      className="mb-3.5 rounded-xl border border-gray-200/90 shadow-xs overflow-hidden hover:border-gray-300 transition-all"
      styles={{ body: { padding: '14px 16px' } }}
    >
      {/* Top Header: Title & Action menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-snug break-words">
            {task.title}
          </h3>
        </div>

        {canEditOrDelete && (
          <Space size={4} className="shrink-0 -mr-1">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined className="text-gray-500 hover:text-blue-600 text-base" />}
              className="h-8 w-8 flex items-center justify-center p-0"
              onClick={() => onEdit(task)}
              aria-label="Edit task"
            />
            <Popconfirm
              title="Delete Task"
              description="Are you sure you want to delete this task?"
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(task.id)}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined className="text-base" />}
                className="h-8 w-8 flex items-center justify-center p-0"
                aria-label="Delete task"
              />
            </Popconfirm>
          </Space>
        )}
      </div>

      {/* Badges row: Priority, Status, Completion Type, Recurrence */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Tag color={PRIORITY_COLORS[task.priority] || 'default'} className="m-0 font-medium text-xs">
          {task.priority}
        </Tag>

        <Tag color={showAsRejectedForAssignor ? 'red' : (STATUS_COLORS[displayStatus] || 'default')} className="m-0 font-medium text-xs">
          {showAsRejectedForAssignor ? 'REJECTED' : displayStatus}
          {task.completionType === 'INDIVIDUAL' && !isIndividualStatus && (
            <span className="ml-1 text-[11px] text-gray-500 font-normal">(Group)</span>
          )}
          {isIndividualStatus && (
            <span className="ml-1 text-[11px] text-blue-600 font-normal">(Yours)</span>
          )}
        </Tag>
        {isWithin15MinRejection && !showAsRejectedForAssignor && (
          <Tag color="orange" className="m-0 text-xs font-medium">
            Rework Required
          </Tag>
        )}

        <Tag 
          color={task.completionType === 'INDIVIDUAL' ? 'purple' : 'geekblue'} 
          className="m-0 text-xs font-medium"
        >
          {task.completionType === 'INDIVIDUAL' ? 'Individual' : 'Shared'}
        </Tag>

        {task.recurrencePattern && (
          <Tag icon={<SyncOutlined />} className="m-0 text-xs text-gray-600 bg-gray-50">
            {task.recurrencePattern}
          </Tag>
        )}
      </div>

      {/* Structured Details Box */}
      <div className="bg-gray-50/90 rounded-xl p-3 mb-3 space-y-2.5 text-xs border border-gray-100">
        {/* Creator / Assigned by */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 flex items-center gap-1.5 shrink-0">
            <UserOutlined className="text-gray-400" />
            <span>Assigned by:</span>
          </span>
          <span className="font-medium text-gray-800">
            {task.createdBy?.name || 'Assignor'}
          </span>
        </div>

        {/* Due Date */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/50">
          <span className="text-gray-500 flex items-center gap-1.5 shrink-0">
            <CalendarOutlined className="text-gray-400" />
            <span>Due Date:</span>
          </span>
          <span className="font-medium text-gray-800">
            {dayjs(task.deadline).format('MMM DD, YYYY • hh:mm A')}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 flex items-center gap-1.5 shrink-0">
            <ClockCircleOutlined className="text-gray-400" />
            <span>Countdown:</span>
          </span>
          <div className="font-mono text-right font-medium">
            <LiveCountdown deadline={task.deadline} />
          </div>
        </div>

        {/* Assignees & Completion Status Section */}
        <div className="pt-2 border-t border-gray-200/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 font-medium flex items-center gap-1.5">
              <TeamOutlined className="text-gray-400" />
              <span>Assignees & Status:</span>
            </span>
            {task.completionType === 'INDIVIDUAL' && task.assignees?.length > 1 && (
              <Tag color="cyan" className="m-0 text-[10px] font-medium">
                {completedAssigneesCount}/{task.assignees.length} completed
              </Tag>
            )}
            {task.completionType === 'SHARED' && (
              <span className="text-[11px] text-gray-400 italic">Shared completion</span>
            )}
          </div>

          <div className="space-y-1.5">
            {task.assignees && task.assignees.length > 0 ? (
              task.assignees.map((a: any) => {
                const name = a.user?.name || a.name || 'Unknown';
                const isMe = (a.userId || a.user?.id) === currentUserId;
                const status = a.status || task.status;
                return (
                  <div 
                    key={a.userId || a.id} 
                    className="flex items-center justify-between py-1 px-2 rounded-md bg-white border border-gray-100"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`font-medium text-gray-800 truncate ${isMe ? 'text-blue-700' : ''}`}>
                        {name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1 rounded">
                          You
                        </span>
                      )}
                    </div>

                    <Tag 
                      color={STATUS_COLORS[status] || 'default'} 
                      className="m-0 text-[10px] py-0 px-1.5 font-medium shrink-0"
                    >
                      {status}
                    </Tag>
                  </div>
                );
              })
            ) : (
              <span className="text-gray-400 italic">Unassigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Description Snippet */}
      {task.description && (
        <div className="mb-3 text-xs text-gray-600">
          {expanded ? (
            <div className="whitespace-pre-wrap bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-gray-700">
              {task.description}
            </div>
          ) : (
            <p className="line-clamp-2 text-gray-500">
              {task.description}
            </p>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 text-xs mt-1 font-medium flex items-center gap-1 cursor-pointer"
          >
            {expanded ? <>Hide description <UpOutlined className="text-[10px]" /></> : <>View description <DownOutlined className="text-[10px]" /></>}
          </button>
        </div>
      )}

      {/* Action Buttons for Task Lifecycle */}
      {hasActionButtons && (
        <div className="pt-2.5 border-t border-gray-100 flex items-center gap-2">
          {/* Start Work (TODO) */}
          {isAssignee && displayStatus === 'TODO' && (
            <Button
              type="primary"
              block
              size="middle"
              loading={actionLoadingId === `${task.id}-IN_PROGRESS`}
              disabled={!!actionLoadingId}
              className="h-9 font-medium bg-blue-600 hover:bg-blue-500"
              onClick={() => onStatusChange(task, 'IN_PROGRESS')}
            >
              Start Work
            </Button>
          )}

          {/* Complete Task (IN_PROGRESS) */}
          {isAssignee && displayStatus === 'IN_PROGRESS' && (
            <Button
              type="primary"
              block
              size="middle"
              loading={actionLoadingId === `${task.id}-COMPLETED`}
              disabled={!!actionLoadingId}
              className="h-9 bg-blue-600 hover:bg-blue-500 font-medium"
              onClick={() => onStatusChange(task, 'COMPLETED')}
            >
              Complete Task
            </Button>
          )}

          {/* Verify & Reject (Assignor or Super Admin when COMPLETED) */}
          {(isAssignor || isSuperAdmin) && task.status === 'COMPLETED' && (
            <div className="flex gap-2 w-full">
              <Button
                type="primary"
                size="middle"
                icon={<CheckCircleOutlined />}
                loading={actionLoadingId === `${task.id}-VERIFIED`}
                disabled={!!actionLoadingId}
                className="flex-1 h-9 bg-green-600 hover:bg-green-500 font-medium"
                onClick={() => onStatusChange(task, 'VERIFIED')}
              >
                Verify
              </Button>
              <Button
                danger
                size="middle"
                icon={<CloseCircleOutlined />}
                loading={actionLoadingId === `${task.id}-REJECTED`}
                disabled={!!actionLoadingId}
                className="flex-1 h-9 font-medium"
                onClick={() => onStatusChange(task, 'REJECTED')}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
