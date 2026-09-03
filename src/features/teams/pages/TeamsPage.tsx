import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Input, InputNumber, Select, Modal, Form, message, Popconfirm, Tooltip, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
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
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
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
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Teams" 
        extra={
          hasPermission('teams:write') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add Team
            </Button>
          )
        } 
      />
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <Input.Search
            placeholder="Search teams..."
            allowClear
            onSearch={(value) => setSearch(value)}
            className="w-full sm:w-auto"
            style={{ maxWidth: 300 }}
          />
          <Select
            placeholder="Filter by Status"
            allowClear
            onChange={(value) => setStatusFilter(value)}
            className="w-full sm:w-auto"
            style={{ minWidth: 200 }}
            options={[
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Blocked', value: 'BLOCKED' },
            ]}
          />
        </div>

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

      <Modal
        title={editingTeam ? 'Edit Team' : 'Add Team'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="type" label="Team Classification" initialValue="OPERATIONAL">
              <Select
                options={[
                  { label: 'Operational Delivery Team', value: 'OPERATIONAL' },
                  { label: 'Tower Level (Oversight / MEL)', value: 'TOWER' },
                ]}
              />
            </Form.Item>
            <Form.Item name="priorityOrder" label="Priority Order" initialValue={0}>
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={handleCloseModal}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingTeam ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
