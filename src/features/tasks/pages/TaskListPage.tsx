import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Tabs, message, Input, Select, Popconfirm, Space } from 'antd';
import { PlusOutlined, FilterOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { teamService } from '@/features/teams/api/team.service';
import { useUserStore } from '@/features/users/store/user.store';
import { useTaskStore } from '../store/task.store';
import { TaskFormModal } from '../components/TaskFormModal';
import { LiveCountdown } from '../components/LiveCountdown';
import { useAuthStore } from '@/features/auth/store/auth.store';

export const TaskListPage: React.FC = () => {
  const { tasks, loading, total, fetchTasks, createTask, updateTask, deleteTask, setTab } = useTaskStore();
  const { user } = useAuthStore();
  const { fetchUsers } = useUserStore();
  const anyUser = user as any;
  const isSuperAdmin = anyUser?.role?.name === 'Super Admin' || anyUser?.type === 'super_admin';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'all' : 'assigned_to_me');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const userTeamId = anyUser?.teamMembers?.[0]?.teamId;
  const [params, setParams] = useState<any>({ page: 1, limit: 10, search: '', status: '', priority: '', teamId: isSuperAdmin ? undefined : userTeamId, assignedToUserId: undefined, createdByUserId: undefined });

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
      // Fallback if no team
      setTeamMembers([
        { user: { id: anyUser?.id, name: anyUser?.name }, role: { level: 99, name: anyUser?.role?.name } }
      ]);
    }
  }, [params.teamId, anyUser, isSuperAdmin, userTeamId]);

  // Authority in task management is strictly governed by team role level
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
          // Task assigned to someone else; switch to 'assigned_by_me' so creator sees it immediately
          message.success('Task created successfully and added to Assigned by Me');
          setActiveTab('assigned_by_me');
          setTab('assigned_by_me');
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

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      sorter: true,
      render: (prio: string) => {
        const colors: any = { LOW: 'green', MEDIUM: 'blue', HIGH: 'orange', CRITICAL: 'red' };
        return <Tag color={colors[prio]}>{prio}</Tag>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (status: string, record: any) => {
        const isAssignor = record.createdById === anyUser?.id || record.createdById === anyUser?.sub;
        const assigneeRecord = record.assignees?.find((a: any) => a.userId === anyUser?.id || a.userId === anyUser?.sub);
        const isAssignee = !!assigneeRecord;

        // Determine the effective status to show
        let displayStatus = status;
        let isIndividualStatus = false;
        if (record.completionType === 'INDIVIDUAL' && isAssignee && !isAssignor && !isSuperAdmin) {
          displayStatus = assigneeRecord.status;
          isIndividualStatus = true;
        }

        const handleStatusChange = async (newStatus: string) => {
          try {
            await useTaskStore.getState().updateTask(record.id, { status: newStatus });
            message.success('Status updated');
            fetchTasks({ ...params, filter: activeTab }); // Ensure UI immediately refreshes
          } catch (error: any) {
            message.error(error.message);
          }
        };

        return (
          <div className="flex items-center gap-2">
            <Tag>
              {displayStatus}
              {record.completionType === 'INDIVIDUAL' && !isIndividualStatus && (
                <span className="ml-1 text-xs text-gray-500">(Group)</span>
              )}
              {isIndividualStatus && (
                <span className="ml-1 text-xs text-blue-500">(Yours)</span>
              )}
            </Tag>

            {isAssignee && displayStatus === 'TODO' && (
              <Button size="small" type="primary" onClick={() => handleStatusChange('IN_PROGRESS')}>
                Start Work
              </Button>
            )}

            {isAssignee && displayStatus === 'IN_PROGRESS' && (
              <Button size="small" type="primary" className="bg-blue-600" onClick={() => handleStatusChange('COMPLETED')}>
                Complete Task
              </Button>
            )}

            {(isAssignor || isSuperAdmin) && status === 'COMPLETED' && (
              <>
                <Button size="small" type="primary" className="bg-green-600 hover:bg-green-500" onClick={() => handleStatusChange('VERIFIED')}>
                  Verify
                </Button>
                <Button size="small" danger onClick={() => handleStatusChange('IN_PROGRESS')}>
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      }
    },
    {
      title: 'Deadline Countdown',
      dataIndex: 'deadline',
      key: 'deadline',
      render: (deadline: string) => <LiveCountdown deadline={deadline} />
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const isAssignor = record.createdById === anyUser?.id || record.createdById === anyUser?.sub;
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Management</h1>
        {!isSuperAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
          >
            Create Task
          </Button>
        )}
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 mr-2">
            <FilterOutlined className="text-gray-400" />
            <span className="font-medium text-gray-600">Filters</span>
          </div>
          <div className="flex-1 min-w-50">
            <Input.Search
              placeholder="Search tasks..."
              onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
              allowClear
            />
          </div>
          <Select
            placeholder="Status"
            allowClear
            className="flex-1 min-w-30"
            value={params.status || undefined}
            onChange={(val) => setParams({ ...params, status: val || undefined, page: 1 })}
            options={[
              { value: 'TODO', label: 'TODO' },
              { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
              { value: 'IN_REVIEW', label: 'IN REVIEW' },
              { value: 'COMPLETED', label: 'COMPLETED' },
              { value: 'VERIFIED', label: 'VERIFIED' },
            ]}
          />
          <Select
            placeholder="Priority"
            allowClear
            className="flex-1 min-w-30"
            value={params.priority || undefined}
            onChange={(val) => setParams({ ...params, priority: val || undefined, page: 1 })}
            options={[
              { value: 'LOW', label: 'LOW' },
              { value: 'MEDIUM', label: 'MEDIUM' },
              { value: 'HIGH', label: 'HIGH' },
              { value: 'CRITICAL', label: 'CRITICAL' }
            ]}
          />
          <Select
            placeholder="Team"
            allowClear
            showSearch
            disabled={!isSuperAdmin}
            optionFilterProp="label"
            className="flex-1 min-w-35"
            value={params.teamId || undefined}
            onChange={(val) => setParams({ ...params, teamId: val || undefined, page: 1, assignedToUserId: undefined })}
            options={(teams || []).map(t => ({ value: t.id, label: t.name }))}
          />
          <Select
            placeholder="Assignee"
            allowClear
            showSearch
            optionFilterProp="label"
            className="flex-1 min-w-35"
            value={params.assignedToUserId || undefined}
            onChange={(val) => setParams({ ...params, assignedToUserId: val || undefined, page: 1 })}
            options={eligibleAssignees.map((member: any) => ({
              value: member.user?.id || member.id,
              label: member.user?.name || member.name
            }))}
          />
        </div>
      </div>

      <Card>
        {!isSuperAdmin && (
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              { key: 'assigned_to_me', label: 'Assigned to Me' },
              { key: 'assigned_by_me', label: 'Assigned by Me' }
            ]}
          />
        )}

        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: params.page,
            pageSize: params.limit,
            total: total
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
      </Card>

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
