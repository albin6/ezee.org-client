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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('assigned_to_me');
  
  const anyUser = user as any;
  const teamMembers = [
    { user: { id: anyUser?.id, name: anyUser?.name }, role: { level: anyUser?.role?.level, name: anyUser?.role?.name } }
  ];
  const currentUserLevel = anyUser?.role?.level ?? 99;

  useEffect(() => {
    fetchTasks({ filter: activeTab });
  }, [activeTab, fetchTasks]);

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
      render: (status: string) => <Tag>{status}</Tag>
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
