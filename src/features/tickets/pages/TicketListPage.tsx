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

        <div className="hidden md:block">
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

        <div className="block md:hidden space-y-3">
          {tickets.length > 0 ? tickets.map((ticket: any) => (
            <div 
              key={ticket.id} 
              className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              onClick={() => navigate(`/tickets/${ticket.id}`)}
            >
               <div className="flex justify-between items-start">
                 <div className="flex gap-3 overflow-hidden">
                    <Avatar className="bg-blue-100 text-blue-600 font-semibold flex-shrink-0 mt-0.5">{ticket.createdBy?.name?.charAt(0) || 'U'}</Avatar>
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-gray-800 leading-tight text-sm truncate">{ticket.title}</span>
                      <span className="text-xs text-gray-500 mt-1 truncate">{ticket.createdBy?.name} • {ticket.team?.name || 'No Team'}</span>
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                   <span className="text-[10px] text-gray-400">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                   {ticket.status === 'OPEN' && (
                     <span className="bg-[#1677ff] text-white text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm">New</span>
                   )}
                 </div>
               </div>
            </div>
          )) : (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">
              No tickets found
            </div>
          )}
          <div className="flex justify-between items-center mt-4 pt-2 border-t border-gray-100">
            <Button 
              size="small"
              disabled={params.page === 1} 
              onClick={() => setParams({ ...params, page: params.page - 1 })}
            >
              Previous
            </Button>
            <span className="text-xs text-gray-500">Page {params.page}</span>
            <Button 
              size="small"
              disabled={tickets.length < params.limit}
              onClick={() => setParams({ ...params, page: params.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
