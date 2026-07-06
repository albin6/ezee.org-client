import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Space, Input, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useTicketStore } from '../store/ticket.store';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const { tickets, loading, total, fetchTickets } = useTicketStore();
  const { hasPermission } = usePermissions();
  const [params, setParams] = useState({ page: 1, limit: 10, search: '', status: '' });

  useEffect(() => {
    fetchTickets(params);
  }, [params, fetchTickets]);

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => <Link to={`/tickets/${record.id}`}>{text}</Link>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'OPEN' ? 'blue' : status === 'IN_PROGRESS' ? 'orange' : status === 'RESOLVED' ? 'green' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={priority === 'URGENT' ? 'red' : priority === 'HIGH' ? 'magenta' : 'default'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (createdBy: any) => createdBy?.name || 'Unknown',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Tickets & Issues"
        description="Manage your enterprise tickets and issues here."
        extra={
          hasPermission('tickets:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tickets/new')}>
              Create Ticket
            </Button>
          )
        }
      />
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <Space className="mb-4">
          <Input.Search
            placeholder="Search tickets..."
            onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
            style={{ width: 250 }}
          />
          <Select
            placeholder="Filter Status"
            allowClear
            style={{ width: 150 }}
            onChange={(val) => setParams({ ...params, status: val || '', page: 1 })}
            options={[
              { value: 'OPEN', label: 'Open' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'CLOSED', label: 'Closed' },
            ]}
          />
        </Space>
        <Table
          dataSource={tickets}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: params.page,
            pageSize: params.limit,
            total: total,
            onChange: (page, limit) => setParams({ ...params, page, limit }),
          }}
        />
      </div>
    </PageContainer>
  );
};
