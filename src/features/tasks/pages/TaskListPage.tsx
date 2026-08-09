import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Tabs, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTaskStore } from '../store/task.store';
import { TaskFormModal } from '../components/TaskFormModal';
import { LiveCountdown } from '../components/LiveCountdown';
import { useAuthStore } from '@/features/auth/store/auth.store';

export const TaskListPage: React.FC = () => {
  const { tasks, loading, fetchTasks, createTask } = useTaskStore();
  const { user } = useAuthStore();
  const anyUser = user as any;
  const isSuperAdmin = anyUser?.role?.name === 'Super Admin' || anyUser?.type === 'super_admin';
  const currentUserLevel = anyUser?.teamMembers?.[0]?.role?.level ?? anyUser?.role?.level ?? 99;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'all' : 'assigned_to_me');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks({ filter: activeTab });

    const teamId = anyUser?.teamMembers?.[0]?.teamId;
    if (teamId) {
      import('@/features/teams/api/team.service').then(m => {
        m.teamService.getTeamMembers(teamId, { limit: 1000 }).then(res => {
          setTeamMembers(res.data || []);
        }).catch(console.error);
      });
    } else {
      // Fallback if no team (e.g. Super Admin not bound to a team yet, just show themselves for now)
      setTeamMembers([
        { user: { id: anyUser?.id, name: anyUser?.name }, role: { level: anyUser?.role?.level, name: anyUser?.role?.name } }
      ]);
    }
  }, [activeTab, fetchTasks, anyUser]);

  const handleCreate = async (values: any) => {
    try {
      // Hardcode teamId for now, ideally selected or fetched from context
      await createTask({ ...values, teamId: anyUser?.teamMembers?.[0]?.teamId || '' });
      message.success('Task created successfully');
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (prio: string) => {
        const colors: any = { LOW: 'green', MEDIUM: 'blue', HIGH: 'orange', CRITICAL: 'red' };
        return <Tag color={colors[prio]}>{prio}</Tag>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => {
        const isAssignor = record.createdById === anyUser?.id;
        const isAssignee = record.assignees?.some((a: any) => a.userId === anyUser?.id);

        const handleStatusChange = async (newStatus: string) => {
          try {
            await useTaskStore.getState().updateTask(record.id, { status: newStatus });
            message.success('Status updated');
            fetchTasks({ filter: activeTab }); // Ensure UI immediately refreshes
          } catch (error: any) {
            message.error(error.message);
          }
        };

        return (
          <div className="flex items-center gap-2">
            <Tag>{status}</Tag>

            {isAssignee && status === 'TODO' && (
              <Button size="small" type="primary" onClick={() => handleStatusChange('IN_PROGRESS')}>
                Start Work
              </Button>
            )}

            {isAssignee && status === 'IN_PROGRESS' && (
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
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {!isSuperAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
          >
            Create Task
          </Button>
        )}
      </div>

      <Card>
        {!isSuperAdmin && (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
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
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <TaskFormModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        teamMembers={teamMembers}
        currentUserLevel={currentUserLevel}
      />
    </div>
  );
};
