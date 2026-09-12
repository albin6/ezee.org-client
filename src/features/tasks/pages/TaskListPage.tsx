import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Tabs, message, Input, Select, Popconfirm, Space, Pagination, Badge, Empty, Spin, Tooltip, Popover } from 'antd';
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
  UserOutlined,
  TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { teamService } from '@/features/teams/api/team.service';
import { useUserStore } from '@/features/users/store/user.store';
import { useTaskStore } from '../store/task.store';
import { TaskFormModal } from '../components/TaskFormModal';
import { LiveCountdown } from '../components/LiveCountdown';
import { TaskMobileCard } from '../components/TaskMobileCard';
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
    fetchUsers({ page: 1, limit: 100, teamId: params.teamId }).catch(console.error);
  }, [fetchUsers, params.teamId]);

  useEffect(() => {
    const fetchId = isSuperAdmin ? params.teamId : userTeamId;
    if (fetchId) {
      import('@/features/teams/api/team.service').then(m => {
        m.teamService.getTeamMembers(fetchId, { limit: 1000 }).then(res => {
          setTeamMembers(res.data || []);
        }).catch(console.error);
      });
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: any) => {
    setEditingTask(task);
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

  const handleStatusChange = async (record: any, newStatus: string) => {
    const actionKey = `${record.id}-${newStatus}`;
    if (actionLoadingId === actionKey) return;
    try {
      setActionLoadingId(actionKey);
      await useTaskStore.getState().updateTask(record.id, { status: newStatus });
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
              <span className="text-xs text-gray-500 truncate cursor-help">
                {record.description}
              </span>
            </Tooltip>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Tag 
              color={record.completionType === 'INDIVIDUAL' ? 'purple' : 'geekblue'} 
              className="m-0 text-[10px] py-0 px-1 font-medium"
            >
              {record.completionType === 'INDIVIDUAL' ? 'Individual' : 'Shared'}
            </Tag>
            {record.recurrencePattern && (
              <Tag icon={<SyncOutlined />} className="m-0 text-[10px] text-gray-600 bg-gray-50 py-0 px-1">
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
      render: (_: any, record: any) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium whitespace-nowrap">
          <UserOutlined className="text-gray-400 text-xs" />
          <span>{record.createdBy?.name || 'Assignor'}</span>
        </div>
      )
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
          <div className="flex flex-col gap-1.5 min-w-[170px] max-w-[220px]">
            {record.completionType === 'INDIVIDUAL' && assignees.length > 0 && (
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-600 mb-0.5">
                <span>Progress:</span>
                <Tag color="cyan" className="m-0 text-[10px] py-0 px-1.5 font-medium">
                  {completedCount}/{assignees.length} done
                </Tag>
              </div>
            )}

            <div className="space-y-1">
              {assignees.slice(0, 2).map((a: any) => {
                const isMe = (a.userId || a.user?.id) === currentUserId;
                const status = a.status || record.status;
                return (
                  <div key={a.userId || a.id} className="flex items-center justify-between gap-1 text-xs">
                    <span className={`truncate text-gray-700 font-medium text-[11px] ${isMe ? 'text-blue-700' : ''}`}>
                      {a.user?.name || 'User'} {isMe && '(You)'}
                    </span>
                    <Tag color={STATUS_COLORS[status] || 'default'} className="m-0 text-[10px] py-0 px-1 shrink-0">
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
                          <div key={a.userId || a.id} className="flex items-center justify-between gap-2 text-xs py-0.5 border-b border-gray-50 last:border-0">
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
                  <span className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
                    +{assignees.length - 2} more assignees...
                  </span>
                </Popover>
              )}

              {assignees.length === 0 && (
                <span className="text-gray-400 italic text-xs">Unassigned</span>
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
      render: (prio: string) => {
        return <Tag color={PRIORITY_COLORS[prio] || 'default'} className="m-0 font-medium">{prio}</Tag>;
      }
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

        let displayStatus = status;
        let isIndividualStatus = false;
        if (record.completionType === 'INDIVIDUAL' && isAssignee) {
          displayStatus = assigneeRecord.status;
          isIndividualStatus = true;
        }

        return (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag color={STATUS_COLORS[displayStatus] || 'default'}>
              {displayStatus}
              {record.completionType === 'INDIVIDUAL' && !isIndividualStatus && (
                <span className="ml-1 text-xs text-gray-500">(Group)</span>
              )}
              {isIndividualStatus && (
                <span className="ml-1 text-xs text-blue-500">(Yours)</span>
              )}
            </Tag>

            {isAssignee && (displayStatus === 'TODO' || displayStatus === 'REJECTED') && (
              <Button
                size="small"
                type="primary"
                loading={actionLoadingId === `${record.id}-IN_PROGRESS`}
                disabled={!!actionLoadingId}
                className={displayStatus === 'REJECTED' ? 'bg-orange-600 hover:bg-orange-500' : ''}
                onClick={() => handleStatusChange(record, 'IN_PROGRESS')}
              >
                {displayStatus === 'REJECTED' ? 'Start Work Again' : 'Start Work'}
              </Button>
            )}

            {isAssignee && displayStatus === 'IN_PROGRESS' && (
              <Button
                size="small"
                type="primary"
                loading={actionLoadingId === `${record.id}-COMPLETED`}
                disabled={!!actionLoadingId}
                className="bg-blue-600"
                onClick={() => handleStatusChange(record, 'COMPLETED')}
              >
                Complete Task
              </Button>
            )}

            {(isAssignor || isSuperAdmin) && status === 'COMPLETED' && (
              <>
                <Button
                  size="small"
                  type="primary"
                  loading={actionLoadingId === `${record.id}-VERIFIED`}
                  disabled={!!actionLoadingId}
                  className="bg-green-600 hover:bg-green-500"
                  onClick={() => handleStatusChange(record, 'VERIFIED')}
                >
                  Verify
                </Button>
                <Button
                  size="small"
                  danger
                  loading={actionLoadingId === `${record.id}-REJECTED`}
                  disabled={!!actionLoadingId}
                  onClick={() => handleStatusChange(record, 'REJECTED')}
                >
                  Reject
                </Button>
              </>
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
        <div className="flex flex-col gap-0.5 text-xs whitespace-nowrap">
          <span className="text-gray-700 font-medium flex items-center gap-1">
            <CalendarOutlined className="text-gray-400 text-xs" />
            {dayjs(deadline).format('MMM DD, YYYY')}
          </span>
          <span className="text-[11px] text-gray-400 pl-4">
            {dayjs(deadline).format('hh:mm A')}
          </span>
          <div className="mt-0.5">
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
        {!isSuperAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="w-full sm:w-auto h-9 font-medium shadow-xs"
          >
            Create Task
          </Button>
        )}
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
              { value: 'TODO', label: 'TODO' },
              { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
              { value: 'IN_REVIEW', label: 'IN REVIEW' },
              { value: 'COMPLETED', label: 'COMPLETED' },
              { value: 'VERIFIED', label: 'VERIFIED' },
              { value: 'REJECTED', label: 'REJECTED' },
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
                    { value: 'TODO', label: 'TODO' },
                    { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
                    { value: 'IN_REVIEW', label: 'IN REVIEW' },
                    { value: 'COMPLETED', label: 'COMPLETED' },
                    { value: 'VERIFIED', label: 'VERIFIED' },
                    { value: 'REJECTED', label: 'REJECTED' },
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

        {/* Desktop View: Full Table (md: and up) */}
        <div className="hidden md:block">
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
