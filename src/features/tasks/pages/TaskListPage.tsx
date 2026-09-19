import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Tabs, message, Input, Select, Popconfirm, Space, Pagination, Badge, Empty, Spin, Tooltip, Popover, Avatar, Segmented } from 'antd';
import { 
  PlusOutlined, 
  FilterOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  CloseCircleOutlined,
  DownOutlined,
  UpOutlined,
  SyncOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { teamService } from '@/features/teams/api/team.service';
import { useUserStore } from '@/features/users/store/user.store';
import { useTaskStore } from '../store/task.store';
import { TaskFormModal } from '../components/TaskFormModal';
import { LiveCountdown } from '../components/LiveCountdown';
import { TaskMobileCard } from '../components/TaskMobileCard';
import { TaskKanbanBoard } from '../components/TaskKanbanBoard';
import { useAuthStore } from '@/features/auth/store/auth.store';

const STATUS_COLORS: Record<string, string> = {
  TODO: 'default',
  IN_PROGRESS: 'blue',
  IN_REVIEW: 'purple',
  COMPLETED: 'gold',
  VERIFIED: 'green',
  REJECTED: 'red',
  CANCELLED: 'default',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'green',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red',
};

export const TaskListPage: React.FC = () => {
  const { tasks, loading, total, fetchTasks, createTask, updateTask, deleteTask, setTab } = useTaskStore();
  const { user } = useAuthStore();
  const { fetchUsers } = useUserStore();
  const anyUser = user as any;
  const isSuperAdmin = anyUser?.role?.name === 'Super Admin' || anyUser?.type === 'super_admin';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'all' : 'assigned_to_me');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>(() => {
    return (localStorage.getItem('task_view_mode') as 'table' | 'kanban') || 'table';
  });

  const handleViewModeChange = (mode: 'table' | 'kanban') => {
    setViewMode(mode);
    localStorage.setItem('task_view_mode', mode);
  };

  const userTeamId = anyUser?.teamMembers?.[0]?.teamId;
  const [params, setParams] = useState<any>({ 
    page: 1, 
    limit: 10, 
    search: '', 
    status: '', 
    priority: '', 
    teamId: isSuperAdmin ? undefined : userTeamId, 
    assignedToUserId: undefined, 
    createdByUserId: undefined 
  });

  useEffect(() => {
    fetchTasks({ ...params, filter: activeTab });
  }, [params, activeTab, fetchTasks]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setTab(key);
  };

  useEffect(() => {
    teamService.getTeams({ page: 1, limit: 100 }).then(res => setTeams(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    fetchUsers({ page: 1, limit: 1000, teamId: params.teamId }).catch(console.error);
  }, [fetchUsers, params.teamId]);

  useEffect(() => {
    const fetchId = isSuperAdmin ? params.teamId : userTeamId;
    if (fetchId) {
      teamService.getTeamMembers(fetchId, { limit: 1000 }).then(res => {
        setTeamMembers(res.data || []);
      }).catch(console.error);
    } else {
      setTeamMembers([
        { user: { id: anyUser?.id, name: anyUser?.name }, role: { level: 99, name: anyUser?.role?.name } }
      ]);
    }
  }, [params.teamId, anyUser, isSuperAdmin, userTeamId]);

  const currentUserMember = teamMembers.find(
    m => m.user?.id === anyUser?.id || m.user?.id === anyUser?.sub || m.userId === anyUser?.id || m.userId === anyUser?.sub
  );
  const currentUserLevel = isSuperAdmin ? 0 : Number(currentUserMember?.role?.level ?? 99);

  const eligibleAssignees = teamMembers.filter(member => {
    if (isSuperAdmin) return true;
    const memberLevel = Number(member.role?.level ?? 99);
    return currentUserLevel <= memberLevel;
  });

  const handleOpenCreate = () => {
    setEditingTask(null);
    const targetTeamId = isSuperAdmin ? params.teamId || userTeamId : userTeamId;
    if (targetTeamId) {
      teamService.getTeamMembers(targetTeamId, { limit: 1000 }).then(res => {
        if (res.data && res.data.length > 0) {
          setTeamMembers(res.data);
        }
      }).catch(console.error);
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: any) => {
    setEditingTask(task);
    if (task.teamId) {
      teamService.getTeamMembers(task.teamId, { limit: 1000 }).then(res => {
        if (res.data && res.data.length > 0) {
          setTeamMembers(res.data);
        }
      }).catch(console.error);
    }
    setIsModalOpen(true);
  };

  const handleSubmitTask = async (values: any) => {
    try {
      const currentUserId = anyUser?.id || anyUser?.sub;
      if (editingTask) {
        await updateTask(editingTask.id, values);
        message.success('Task updated successfully');
        await fetchTasks({ ...params, filter: activeTab });
      } else {
        const targetTeamId = isSuperAdmin ? params.teamId || userTeamId : userTeamId;
        const createdTask = await createTask({ ...values, teamId: targetTeamId || '' }, currentUserId);

        const isAssignedToMe = createdTask?.assignees?.some(
          (a: any) => (a.userId || a.user?.id) === currentUserId
        ) || values.assigneeIds?.includes(currentUserId);

        if (!isAssignedToMe && activeTab === 'assigned_to_me' && !isSuperAdmin) {
          message.success('Task created successfully and added to Assigned by Me');
          setActiveTab('assigned_by_me');
          setTab('assigned_by_me');
        } else if (isAssignedToMe && activeTab === 'assigned_by_me' && !isSuperAdmin) {
          message.success('Task created successfully and added to Assigned to Me');
          setActiveTab('assigned_to_me');
          setTab('assigned_to_me');
        } else {
          message.success('Task created successfully');
          await fetchTasks({ ...params, filter: activeTab });
        }
      }
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      message.success('Task deleted successfully');
      await fetchTasks({ ...params, filter: activeTab });
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleStatusChange = async (record: any, newStatus: string, assigneeId?: string) => {
    const actionKey = assigneeId ? `${record.id}-${assigneeId}-${newStatus}` : `${record.id}-${newStatus}`;
    if (actionLoadingId === actionKey) return;
    try {
      setActionLoadingId(actionKey);
      await useTaskStore.getState().updateTask(record.id, { 
        status: newStatus,
        ...(assigneeId ? { assigneeId } : {})
      });
      message.success('Status updated');
      await fetchTasks({ ...params, filter: activeTab });
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const resetFilters = () => {
    setParams({
      ...params,
      search: '',
      status: '',
      priority: '',
      teamId: isSuperAdmin ? undefined : userTeamId,
      assignedToUserId: undefined,
      page: 1,
    });
  };

  const activeFiltersCount = [
    params.search,
    params.status,
    params.priority,
    isSuperAdmin && params.teamId,
    params.assignedToUserId,
  ].filter(Boolean).length;

  const currentUserId = anyUser?.id || anyUser?.sub;

  const columns = [
    {
      title: 'Task',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      render: (title: string, record: any) => (
        <div className="flex flex-col gap-1 max-w-[260px]">
          <span className="font-semibold text-gray-900 text-sm leading-snug">{title}</span>
          {record.description && (
            <Tooltip title={record.description} placement="topLeft">
              <span className="text-xs text-gray-500 line-clamp-2 cursor-help">
                {record.description}
              </span>
            </Tooltip>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Tag 
              color={record.completionType === 'INDIVIDUAL' ? 'purple' : 'geekblue'} 
              className="m-0 text-[10px] py-0 px-1.5 font-medium rounded"
            >
              {record.completionType === 'INDIVIDUAL' ? 'Individual' : 'Shared'}
            </Tag>
            {record.recurrencePattern && (
              <Tag icon={<SyncOutlined />} className="m-0 text-[10px] text-gray-600 bg-gray-50 py-0 px-1.5 rounded">
                {record.recurrencePattern}
              </Tag>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Assignor',
      key: 'createdById',
      width: 135,
      render: (_: any, record: any) => {
        const name = record.createdBy?.name || 'Assignor';
        const initial = name.charAt(0).toUpperCase();
        return (
          <div className="flex items-center gap-2 pt-0.5">
            <Avatar size={26} className="bg-purple-100 text-purple-700 font-semibold text-xs shrink-0 border border-purple-200">
              {initial}
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-gray-900 truncate" title={name}>
                {name}
              </span>
              <span className="text-[10px] text-gray-400">Created by</span>
            </div>
          </div>
        );
      }
    },
    {
      title: (
        <span className="flex items-center gap-1.5">
          <TeamOutlined className="text-gray-400" />
          <span>Assignees & Status</span>
        </span>
      ),
      key: 'assignees',
      render: (_: any, record: any) => {
        const assignees = record.assignees || [];
        const completedCount = record.completionType === 'INDIVIDUAL'
          ? assignees.filter((a: any) => a.status === 'COMPLETED' || a.status === 'VERIFIED').length
          : 0;

        return (
          <div className="bg-gray-50/90 rounded-lg p-2 border border-gray-200/60 flex flex-col gap-1.5 min-w-[190px] max-w-[240px]">
            <div className="flex items-center justify-between gap-1 pb-1 border-b border-gray-200/50">
              <span className="text-[11px] font-medium text-gray-500">
                {record.completionType === 'INDIVIDUAL' ? 'Progress:' : 'Assignment:'}
              </span>
              {record.completionType === 'INDIVIDUAL' ? (
                <Tag color={completedCount === assignees.length && assignees.length > 0 ? 'green' : 'cyan'} className="m-0 text-[10px] py-0 px-1.5 font-semibold">
                  {completedCount}/{assignees.length} done
                </Tag>
              ) : (
                <Tag color="geekblue" className="m-0 text-[10px] py-0 px-1.5 font-medium">
                  Shared
                </Tag>
              )}
            </div>

            <div className="space-y-1">
              {assignees.slice(0, 2).map((a: any) => {
                const isMe = (a.userId || a.user?.id) === currentUserId;
                const status = a.status || record.status;
                const name = a.user?.name || 'User';
                return (
                  <div key={a.userId || a.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[11px] truncate ${isMe ? 'text-blue-700 font-semibold' : 'text-gray-700 font-medium'}`}>
                        {name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 font-semibold px-1 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <Tag color={STATUS_COLORS[status] || 'default'} className="m-0 text-[10px] py-0 px-1 font-medium shrink-0">
                      {status}
                    </Tag>
                  </div>
                );
              })}

              {assignees.length > 2 && (
                <Popover
                  title="All Assignees & Status"
                  content={
                    <div className="space-y-1.5 min-w-[200px]">
                      {assignees.map((a: any) => {
                        const isMe = (a.userId || a.user?.id) === currentUserId;
                        const status = a.status || record.status;
                        return (
                          <div key={a.userId || a.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                            <span className={`font-medium ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>
                              {a.user?.name || 'User'} {isMe && '(You)'}
                            </span>
                            <Tag color={STATUS_COLORS[status] || 'default'} className="m-0 text-[10px]">
                              {status}
                            </Tag>
                          </div>
                        );
                      })}
                    </div>
                  }
                >
                  <span className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer font-medium pt-0.5 block">
                    +{assignees.length - 2} more assignees...
                  </span>
                </Popover>
              )}

              {assignees.length === 0 && (
                <span className="text-gray-400 italic text-[11px]">Unassigned</span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      sorter: true,
      render: (prio: string) => (
        <div className="pt-0.5">
          <Tag color={PRIORITY_COLORS[prio] || 'default'} className="m-0 font-medium text-xs">
            {prio}
          </Tag>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (status: string, record: any) => {
        const isAssignor = record.createdById === currentUserId;
        const assigneeRecord = record.assignees?.find(
          (a: any) => (a.userId || a.user?.id) === currentUserId
        );
        const isAssignee = !!assigneeRecord;
        const rejectedTime = record.rejectedAt ? new Date(record.rejectedAt).getTime() : 0;
        const isWithin15MinRejection = rejectedTime > 0 && (Date.now() - rejectedTime) < 15 * 60 * 1000;

        let displayStatus = status;
        let isIndividualStatus = false;
        if (record.completionType === 'INDIVIDUAL' && isAssignee) {
          displayStatus = assigneeRecord.status;
          isIndividualStatus = true;
        }

        const showAsRejectedForAssignor = isWithin15MinRejection && (isAssignor || isSuperAdmin);

        return (
          <div className="flex flex-col gap-1.5 pt-0.5 items-start">
            <div className="flex items-center gap-1 flex-wrap">
              <Tag color={showAsRejectedForAssignor ? 'red' : (STATUS_COLORS[displayStatus] || 'default')} className="m-0 font-medium">
                {showAsRejectedForAssignor ? 'REJECTED' : displayStatus}
                {record.completionType === 'INDIVIDUAL' && !isIndividualStatus && (
                  <span className="ml-1 text-xs text-gray-500 font-normal">(Group)</span>
                )}
                {isIndividualStatus && (
                  <span className="ml-1 text-xs text-blue-600 font-normal">(Yours)</span>
                )}
              </Tag>
              {isWithin15MinRejection && !showAsRejectedForAssignor && (
                <Tag color="orange" className="m-0 text-[10px] font-medium">
                  Rework
                </Tag>
              )}
            </div>

            {isAssignee && displayStatus === 'TODO' && (
              <Button
                size="small"
                type="primary"
                loading={!!(actionLoadingId === `${record.id}-IN_PROGRESS` || (currentUserId && actionLoadingId === `${record.id}-${currentUserId}-IN_PROGRESS`))}
                disabled={!!actionLoadingId}
                className="text-xs"
                onClick={() => handleStatusChange(record, 'IN_PROGRESS', record.completionType === 'INDIVIDUAL' ? currentUserId : undefined)}
              >
                Start Work
              </Button>
            )}

            {isAssignee && displayStatus === 'IN_PROGRESS' && (
              <Button
                size="small"
                type="primary"
                loading={!!(actionLoadingId === `${record.id}-COMPLETED` || (currentUserId && actionLoadingId === `${record.id}-${currentUserId}-COMPLETED`))}
                disabled={!!actionLoadingId}
                className="bg-blue-600 text-xs"
                onClick={() => handleStatusChange(record, 'COMPLETED', record.completionType === 'INDIVIDUAL' ? currentUserId : undefined)}
              >
                Complete Task
              </Button>
            )}

            {(isAssignor || isSuperAdmin) && status === 'COMPLETED' && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="small"
                  type="primary"
                  loading={actionLoadingId === `${record.id}-VERIFIED`}
                  disabled={!!actionLoadingId}
                  className="bg-green-600 hover:bg-green-500 text-xs"
                  onClick={() => handleStatusChange(record, 'VERIFIED')}
                >
                  Verify
                </Button>
                <Button
                  size="small"
                  danger
                  loading={actionLoadingId === `${record.id}-REJECTED`}
                  disabled={!!actionLoadingId}
                  className="text-xs"
                  onClick={() => handleStatusChange(record, 'REJECTED')}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Deadline & Countdown',
      dataIndex: 'deadline',
      key: 'deadline',
      sorter: true,
      render: (deadline: string) => (
        <div className="flex flex-col gap-1 pt-0.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
            <CalendarOutlined className="text-gray-400 text-xs" />
            <span>{dayjs(deadline).format('MMM DD, YYYY • hh:mm A')}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100/90 border border-gray-200/60 font-mono text-xs text-gray-700 w-fit">
            <ClockCircleOutlined className="text-gray-400 text-[11px]" />
            <LiveCountdown deadline={deadline} />
          </div>
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const isAssignor = record.createdById === currentUserId;
        const canEdit = isAssignor || isSuperAdmin;

        if (!canEdit) return null;

        return (
          <div className="pt-0.5">
            <Space size="small">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEdit(record)}
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete Task"
                description="Are you sure you want to delete this task?"
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDeleteTask(record.id)}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Space>
          </div>
        );
      }
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Task Management</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Track, assign, and manage team workflows</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <Segmented
            value={viewMode}
            onChange={(val) => handleViewModeChange(val as 'table' | 'kanban')}
            options={[
              { value: 'table', label: 'Table', icon: <UnorderedListOutlined /> },
              { value: 'kanban', label: 'Kanban', icon: <AppstoreOutlined /> },
            ]}
            className="bg-gray-100 p-0.5 border border-gray-200/70"
          />

          {!isSuperAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              className="h-9 font-medium shadow-xs shrink-0"
            >
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-3.5 sm:p-5 rounded-xl shadow-xs border border-gray-200/80">
        {/* Desktop Filter Bar (md: and up) */}
        <div className="hidden md:flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 mr-1 text-gray-600">
            <FilterOutlined className="text-gray-400" />
            <span className="font-medium text-sm">Filters</span>
          </div>

          <div className="flex-1 min-w-[200px]">
            <Input.Search
              placeholder="Search tasks..."
              value={params.search}
              onChange={(e) => setParams({ ...params, search: e.target.value })}
              onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
              allowClear
            />
          </div>

          <Select
            placeholder="Status"
            allowClear
            className="w-36"
            value={params.status || undefined}
            onChange={(val) => setParams({ ...params, status: val || undefined, page: 1 })}
            options={[
              { value: 'TODO', label: 'To Do' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'VERIFIED', label: 'Verified' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />

          <Select
            placeholder="Priority"
            allowClear
            className="w-32"
            value={params.priority || undefined}
            onChange={(val) => setParams({ ...params, priority: val || undefined, page: 1 })}
            options={[
              { value: 'LOW', label: 'LOW' },
              { value: 'MEDIUM', label: 'MEDIUM' },
              { value: 'HIGH', label: 'HIGH' },
              { value: 'CRITICAL', label: 'CRITICAL' }
            ]}
          />

          {isSuperAdmin && (
            <Select
              placeholder="Team"
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-40"
              value={params.teamId || undefined}
              onChange={(val) => setParams({ ...params, teamId: val || undefined, page: 1, assignedToUserId: undefined })}
              options={(teams || []).map(t => ({ value: t.id, label: t.name }))}
            />
          )}

          <Select
            placeholder="Assignee"
            allowClear
            showSearch
            optionFilterProp="label"
            className="w-40"
            value={params.assignedToUserId || undefined}
            onChange={(val) => setParams({ ...params, assignedToUserId: val || undefined, page: 1 })}
            options={eligibleAssignees.map((member: any) => ({
              value: member.user?.id || member.id,
              label: member.user?.name || member.name
            }))}
          />

          {activeFiltersCount > 0 && (
            <Button 
              type="text" 
              icon={<CloseCircleOutlined />} 
              onClick={resetFilters}
              className="text-gray-500 hover:text-red-500 text-xs"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Mobile Filter Bar (< md) */}
        <div className="md:hidden space-y-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input.Search
                placeholder="Search tasks..."
                value={params.search}
                onChange={(e) => setParams({ ...params, search: e.target.value })}
                onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
                allowClear
              />
            </div>
            <Badge count={activeFiltersCount} size="small" offset={[-2, 2]}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className={mobileFiltersOpen ? 'border-blue-500 text-blue-600' : ''}
              >
                Filters {mobileFiltersOpen ? <UpOutlined className="text-xs" /> : <DownOutlined className="text-xs" />}
              </Button>
            </Badge>
          </div>

          {mobileFiltersOpen && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <Select
                  placeholder="All Statuses"
                  allowClear
                  className="w-full"
                  value={params.status || undefined}
                  onChange={(val) => setParams({ ...params, status: val || undefined, page: 1 })}
                  options={[
                    { value: 'TODO', label: 'To Do' },
                    { value: 'IN_PROGRESS', label: 'In Progress' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'VERIFIED', label: 'Verified' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                <Select
                  placeholder="All Priorities"
                  allowClear
                  className="w-full"
                  value={params.priority || undefined}
                  onChange={(val) => setParams({ ...params, priority: val || undefined, page: 1 })}
                  options={[
                    { value: 'LOW', label: 'LOW' },
                    { value: 'MEDIUM', label: 'MEDIUM' },
                    { value: 'HIGH', label: 'HIGH' },
                    { value: 'CRITICAL', label: 'CRITICAL' }
                  ]}
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Team</label>
                  <Select
                    placeholder="All Teams"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    className="w-full"
                    value={params.teamId || undefined}
                    onChange={(val) => setParams({ ...params, teamId: val || undefined, page: 1, assignedToUserId: undefined })}
                    options={(teams || []).map(t => ({ value: t.id, label: t.name }))}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assignee</label>
                <Select
                  placeholder="All Assignees"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  className="w-full"
                  value={params.assignedToUserId || undefined}
                  onChange={(val) => setParams({ ...params, assignedToUserId: val || undefined, page: 1 })}
                  options={eligibleAssignees.map((member: any) => ({
                    value: member.user?.id || member.id,
                    label: member.user?.name || member.name
                  }))}
                />
              </div>

              {activeFiltersCount > 0 && (
                <div className="col-span-full pt-1 flex justify-end">
                  <Button 
                    type="link" 
                    danger 
                    size="small"
                    icon={<CloseCircleOutlined />} 
                    onClick={resetFilters}
                    className="p-0 text-xs"
                  >
                    Reset all filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Card: Tabs + View (Table or Mobile Cards) */}
      <Card 
        className="rounded-xl border border-gray-200/80 shadow-xs overflow-hidden"
        styles={{ body: { padding: '16px sm:24px' } }}
      >
        {!isSuperAdmin && (
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            className="mb-3"
            items={[
              { key: 'assigned_to_me', label: 'Assigned to Me' },
              { key: 'assigned_by_me', label: 'Assigned by Me' }
            ]}
          />
        )}

        {viewMode === 'table' ? (
          <>
            {/* Desktop View: Full Table (md: and up) */}
            <div className="hidden md:block [&_.ant-table-tbody_>_tr_>_td]:align-top [&_.ant-table-tbody_>_tr_>_td]:py-3.5">
              <Table
                dataSource={tasks}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{
                  current: params.page,
                  pageSize: params.limit,
                  total: total,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                }}
                onChange={(pagination: any, _filters: any, sorter: any) => {
                  setParams((prev: any) => ({
                    ...prev,
                    page: pagination.current,
                    limit: pagination.pageSize,
                    sortBy: sorter.field,
                    sortOrder: sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined,
                  }));
                }}
              />
            </div>

            {/* Mobile View: Dedicated Mobile Cards (< md) */}
            <div className="md:hidden">
              {loading && (!tasks || tasks.length === 0) ? (
                <div className="flex justify-center items-center py-12">
                  <Spin size="large" />
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="py-10">
                  <Empty description="No tasks found" />
                </div>
              ) : (
                <div>
                  <div className="space-y-3">
                    {tasks.map((task: any) => (
                      <TaskMobileCard
                        key={task.id}
                        task={task}
                        currentUserId={currentUserId}
                        isSuperAdmin={isSuperAdmin}
                        actionLoadingId={actionLoadingId}
                        onStatusChange={handleStatusChange}
                        onEdit={handleOpenEdit}
                        onDelete={handleDeleteTask}
                      />
                    ))}
                  </div>

                  {/* Mobile Pagination */}
                  {total > params.limit && (
                    <div className="flex justify-center items-center mt-5 pt-3 border-t border-gray-100">
                      <Pagination
                        size="small"
                        current={params.page}
                        pageSize={params.limit}
                        total={total}
                        showSizeChanger={false}
                        onChange={(page, pageSize) => {
                          setParams((prev: any) => ({ ...prev, page, limit: pageSize }));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="pt-1">
            <TaskKanbanBoard
              tasks={tasks}
              loading={loading}
              activeFilter={activeTab}
              currentUserId={currentUserId}
              isSuperAdmin={isSuperAdmin}
              actionLoadingId={actionLoadingId}
              onStatusChange={handleStatusChange}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteTask}
            />

            {total > tasks.length && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>
                  Showing {tasks.length} of {total} tasks
                </span>
                {params.limit < 50 && total > params.limit && (
                  <Button
                    size="small"
                    type="link"
                    className="p-0 text-blue-600 font-medium"
                    onClick={() => setParams((prev: any) => ({ ...prev, limit: 50 }))}
                  >
                    Load up to 50 tasks on board
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Task Create / Edit Modal */}
      <TaskFormModal
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleSubmitTask}
        initialValues={editingTask}
        teamMembers={teamMembers}
        currentUserLevel={isSuperAdmin ? 0 : currentUserLevel}
      />
    </div>
  );
};
