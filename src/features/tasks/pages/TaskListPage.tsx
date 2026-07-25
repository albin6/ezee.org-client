import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Tabs, message, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTaskStore } from '../store/task.store';
import { TaskFormModal } from '../components/TaskFormModal';
import { LiveCountdown } from '../components/LiveCountdown';
import { useAuthStore } from '@/features/auth/store/auth.store';

export const TaskListPage: React.FC = () => {
  const { tasks, loading, fetchTasks, createTask } = useTaskStore();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('assigned_to_me');
  
  const anyUser = user as any;
  const currentUserLevel = anyUser?.teamMembers?.[0]?.role?.level ?? anyUser?.role?.level ?? 99;
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
        const isSuperAdmin = anyUser?.role?.name === 'Super Admin';
        
        let availableOptions: { label: string, value: string }[] = [];

        // Base options based on current status for assignees
        if (isAssignee && !isAssignor && !isSuperAdmin) {
          if (status === 'TODO') availableOptions = [{ label: 'IN_PROGRESS', value: 'IN_PROGRESS' }];
          else if (status === 'IN_PROGRESS') availableOptions = [{ label: 'COMPLETED', value: 'COMPLETED' }];
        }
        
        // Assignor options
        if (isAssignor || isSuperAdmin) {
          if (status === 'COMPLETED') {
            availableOptions = [
              { label: 'VERIFIED', value: 'VERIFIED' },
              { label: 'REJECT (IN_PROGRESS)', value: 'IN_PROGRESS' }
            ];
          } else {
            // Assignors can manually adjust statuses as fallback
            availableOptions = [
              { label: 'TODO', value: 'TODO' },
              { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
              { label: 'COMPLETED', value: 'COMPLETED' },
              { label: 'VERIFIED', value: 'VERIFIED' },
              { label: 'CANCELLED', value: 'CANCELLED' }
            ].filter(opt => opt.value !== status);
          }
        }

        const handleStatusChange = async (newStatus: string) => {
          try {
            await useTaskStore.getState().updateTask(record.id, { status: newStatus });
            message.success('Status updated');
          } catch (error: any) {
            message.error(error.message);
          }
        };

        if (availableOptions.length === 0) {
          return <Tag>{status}</Tag>;
        }

        return (
          <div className="flex items-center gap-2">
            <Tag>{status}</Tag>
            <Select 
              size="small" 
              placeholder="Update" 
              onChange={handleStatusChange}
              options={availableOptions}
              value={null}
              style={{ width: 120 }}
            />
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
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setIsModalOpen(true)}
        >
          Create Task
        </Button>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'assigned_to_me', label: 'Assigned to Me' },
            { key: 'assigned_by_me', label: 'Assigned by Me' }
          ]}
        />
        
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
