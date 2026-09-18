import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Input, InputNumber, Select, Modal, Form, message, Popconfirm, Tooltip, Tag, Empty, Spin, Pagination } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { teamService } from '../api/team.service';
import type { Team } from '../api/team.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const TeamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form] = Form.useForm();

  const fetchTeams = async (page = pagination.current, limit = pagination.pageSize) => {
    try {
      setLoading(true);
      const res = await teamService.getTeams({
        page,
        limit,
        search,
        status: statusFilter || undefined,
      });
      setTeams(res.data);
      setTotal(res.meta.total);
      setPagination({ current: res.meta.page, pageSize: res.meta.limit });
    } catch (error) {
      message.error('Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams(1);
  }, [search, statusFilter]);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchTeams(newPagination.current, newPagination.pageSize);
  };

  const handleOpenModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      form.setFieldsValue(team);
    } else {
      setEditingTeam(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingTeam(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingTeam) {
        await teamService.updateTeam(editingTeam.id, values);
        message.success('Team updated successfully');
      } else {
        await teamService.createTeam(values);
        message.success('Team created successfully');
      }
      handleCloseModal();
      fetchTeams();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save team');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await teamService.deleteTeam(id);
      message.success('Team deleted successfully');
      fetchTeams();
    } catch (error: any) {
      message.error('Failed to delete team');
    }
  };

  const handleBlock = async (id: string, isActive: boolean) => {
    try {
      await teamService.blockTeam(id);
      message.success(`Team ${isActive ? 'blocked' : 'unblocked'} successfully`);
      fetchTeams();
    } catch (error: any) {
      message.error('Failed to update team status');
    }
  };

  const columns: ColumnsType<Team> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Team) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{name}</span>
          {record.type === 'TOWER' && (
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>Tower Level</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || <span className="text-gray-400 italic">No description</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {status}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Team) => (
        <Space>
          <Tooltip title="View Details">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/teams/${record.id}`)} />
          </Tooltip>
          {hasPermission('teams:write') && (
            <Tooltip title="Edit Team">
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
            </Tooltip>
          )}
          {hasPermission('teams:block') && (
            <Popconfirm
              title={record.status === 'ACTIVE' ? 'Block Team' : 'Unblock Team'}
              onConfirm={() => handleBlock(record.id, record.status === 'ACTIVE')}
            >
              <Button type="text" danger={record.status === 'ACTIVE'} icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} />
            </Popconfirm>
          )}
          {hasPermission('teams:delete') && (
            <Popconfirm
              title="Are you sure you want to delete this team?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Teams" 
        description="Manage organizational delivery teams, oversight towers, and team memberships."
        extra={
          hasPermission('teams:write') && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto h-10 px-4 rounded-lg font-medium shadow-xs"
            >
              Add Team
            </Button>
          )
        } 
      />
      
      <div className="bg-white p-3.5 sm:p-6 rounded-xl border border-gray-200/80 shadow-xs">
        {/* Search & Status Filter Controls */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <Input.Search
            placeholder="Search teams by name..."
            allowClear
            onSearch={(value) => setSearch(value)}
            className="w-full sm:w-72"
          />
          <Select
            placeholder="Filter by Status"
            allowClear
            onChange={(value) => setStatusFilter(value || '')}
            className="w-full sm:w-44"
            options={[
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Blocked', value: 'BLOCKED' },
            ]}
          />
        </div>

        {/* Desktop View: Full Table (md+) */}
        <div className="hidden md:block">
          <Table 
            scroll={{ x: 'max-content' }}
            columns={columns} 
            dataSource={teams} 
            rowKey="id" 
            loading={loading}
            pagination={{
              ...pagination,
              total,
              showSizeChanger: true,
            }}
            onChange={handleTableChange}
          />
        </div>

        {/* Mobile View: Clean, Responsive Team Cards (< md) */}
        <div className="md:hidden">
          {loading && (!teams || teams.length === 0) ? (
            <div className="flex justify-center items-center py-12">
              <Spin size="large" />
            </div>
          ) : !teams || teams.length === 0 ? (
            <div className="py-10">
              <Empty description="No teams found" />
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div 
                  key={team.id}
                  className="bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 flex flex-col gap-2.5 transition-shadow hover:shadow-xs"
                >
                  {/* Card Header: Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        <TeamOutlined />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm truncate">
                        {team.name}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                      team.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {team.status}
                    </span>
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                    <Tag 
                      color={team.type === 'TOWER' ? 'purple' : 'blue'}
                      className="m-0 text-[11px] rounded-md px-1.5 py-0.5"
                    >
                      {team.type === 'TOWER' ? 'Tower Level' : 'Operational'}
                    </Tag>
                    {team.priorityOrder !== undefined && team.priorityOrder !== null && (
                      <span className="text-[11px] text-gray-500">
                        Priority: <strong className="text-gray-700">{team.priorityOrder}</strong>
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {team.description ? (
                    <p className="text-xs text-gray-600 line-clamp-2 m-0 bg-white/70 p-2 rounded-md border border-gray-100">
                      {team.description}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic m-0">No description provided</p>
                  )}

                  {/* Action Buttons Bar */}
                  <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between gap-2">
                    <Button 
                      type="default" 
                      size="small"
                      icon={<EyeOutlined />} 
                      onClick={() => navigate(`/teams/${team.id}`)}
                      className="flex-1 h-8 text-xs font-medium text-blue-600 border-blue-200 hover:border-blue-400 bg-blue-50/50"
                    >
                      View Details
                    </Button>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {hasPermission('teams:write') && (
                        <Button 
                          type="text" 
                          size="small"
                          icon={<EditOutlined className="text-gray-600 text-sm" />} 
                          onClick={() => handleOpenModal(team)}
                          title="Edit Team"
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200"
                        />
                      )}
                      {hasPermission('teams:block') && (
                        <Popconfirm
                          title={team.status === 'ACTIVE' ? 'Block Team' : 'Unblock Team'}
                          onConfirm={() => handleBlock(team.id, team.status === 'ACTIVE')}
                          okText="Confirm"
                        >
                          <Button 
                            type="text" 
                            size="small"
                            danger={team.status === 'ACTIVE'}
                            icon={team.status === 'ACTIVE' ? <StopOutlined className="text-sm" /> : <CheckCircleOutlined className="text-sm text-green-600" />} 
                            title={team.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200"
                          />
                        </Popconfirm>
                      )}
                      {hasPermission('teams:delete') && (
                        <Popconfirm
                          title="Delete this team?"
                          onConfirm={() => handleDelete(team.id)}
                          okText="Yes"
                          cancelText="No"
                          okButtonProps={{ danger: true }}
                        >
                          <Button 
                            type="text" 
                            size="small"
                            danger 
                            icon={<DeleteOutlined className="text-sm" />} 
                            title="Delete"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200"
                          />
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile Pagination */}
              {total > pagination.pageSize && (
                <div className="flex justify-center items-center pt-3 mt-4 border-t border-gray-100">
                  <Pagination
                    size="small"
                    current={pagination.current}
                    pageSize={pagination.pageSize}
                    total={total}
                    showSizeChanger={false}
                    onChange={(page, pageSize) => handleTableChange({ current: page, pageSize })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Team Modal with Mobile Support */}
      <Modal
        title={<span className="text-base font-semibold">{editingTeam ? 'Edit Team' : 'Add Team'}</span>}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={520}
        centered
        className="max-w-[95vw]"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. Frontend Engineering" className="h-10 rounded-lg" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Describe the team's objectives..." className="rounded-lg" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="type" label="Team Classification" initialValue="OPERATIONAL">
              <Select
                className="h-10"
                options={[
                  { label: 'Operational Delivery Team', value: 'OPERATIONAL' },
                  { label: 'Tower Level (Oversight / MEL)', value: 'TOWER' },
                ]}
              />
            </Form.Item>
            <Form.Item name="priorityOrder" label="Priority Order" initialValue={0}>
              <InputNumber min={0} className="w-full h-10 flex items-center rounded-lg" />
            </Form.Item>
          </div>

          <Form.Item className="mb-0 mt-4 flex justify-end">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button onClick={handleCloseModal} className="w-full sm:w-auto h-10 rounded-lg">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" className="w-full sm:w-auto h-10 rounded-lg">
                {editingTeam ? 'Update Team' : 'Create Team'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

