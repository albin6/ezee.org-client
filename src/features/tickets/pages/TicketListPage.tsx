import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Input, Select, DatePicker, Avatar } from 'antd';
import { PlusOutlined, FilterOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useTicketStore } from '../store/ticket.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { teamService } from '@/features/teams/api/team.service';
import { useUserStore } from '@/features/users/store/user.store';

export const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const { tickets, loading, total, fetchTickets } = useTicketStore();
  const { hasPermission } = usePermissions();
  const [params, setParams] = useState<any>({ page: 1, limit: 10, search: '', status: '' });
  const [teams, setTeams] = useState<any[]>([]);
  const { users, fetchUsers } = useUserStore();

  useEffect(() => {
    fetchTickets(params);
  }, [params, fetchTickets]);

  useEffect(() => {
    teamService.getTeams({ page: 1, limit: 100 }).then(res => setTeams(res.data)).catch(console.error);
    fetchUsers({ page: 1, limit: 100 }).catch(console.error);
  }, [fetchUsers]);

  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    setParams((prev: any) => ({
      ...prev,
      page: pagination.current,
      limit: pagination.pageSize,
      sortBy: sorter.field,
      sortOrder: sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined,
    }));
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      render: (text: string, record: any) => <Link to={`/tickets/${record.id}`}>{text}</Link>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
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
      sorter: true,
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
      sorter: true,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: true,
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
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="mb-6 flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center bg-gray-50 p-4 rounded-md border border-gray-200">
          <div className="flex items-center gap-2 mr-2">
            <FilterOutlined className="text-gray-400" />
            <span className="font-medium text-gray-600">Filters</span>
          </div>

          <Input.Search
            placeholder="Search title, desc, ID..."
            onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
            style={{ width: 220 }}
            allowClear
          />

          <Select
            placeholder="Status"
            allowClear
            style={{ width: 140 }}
            onChange={(val) => setParams({ ...params, status: val || undefined, page: 1 })}
            options={[
              { value: 'OPEN', label: 'Open' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'CLOSED', label: 'Closed' },
              { value: 'REOPENED', label: 'Reopened' },
            ]}
          />

          <Select
            placeholder="Priority"
            allowClear
            style={{ width: 120 }}
            onChange={(val) => setParams({ ...params, priority: val || undefined, page: 1 })}
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
              { value: 'URGENT', label: 'Urgent' },
            ]}
          />

          <Select
            placeholder="Team"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 160 }}
            onChange={(val) => setParams({ ...params, teamId: val || undefined, page: 1 })}
            options={teams.map(t => ({ value: t.id, label: t.name }))}
          />

          <Select
            placeholder="Creator"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 160 }}
            onChange={(val) => setParams({ ...params, createdById: val || undefined, page: 1 })}
            options={users.map((u: any) => ({ value: u.id, label: u.name }))}
          />

          <Select
            placeholder="Assignee"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 160 }}
            onChange={(val) => setParams({ ...params, assigneeId: val || undefined, page: 1 })}
            options={users.map((u: any) => ({ value: u.id, label: u.name }))}
          />

          <DatePicker.RangePicker
            onChange={(dates) => {
              setParams({
                ...params,
                dateFrom: dates?.[0]?.toISOString() || undefined,
                dateTo: dates?.[1]?.toISOString() || undefined,
                page: 1
              });
            }}
          />
        </div>

        <Table
          scroll={{ x: 'max-content' }}
          dataSource={tickets}
          columns={columns}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: params.page,
            pageSize: params.limit,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
          }}
        />
      </div>
    </PageContainer>
  );
};
