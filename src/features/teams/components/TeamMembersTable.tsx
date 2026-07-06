import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, message, Popconfirm, Select, Input, Descriptions, Tag, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { teamService } from '../api/team.service';
import { userService } from '@/features/users/api/user.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface TeamMembersTableProps {
  teamId: string;
}

export const TeamMembersTable: React.FC<TeamMembersTableProps> = ({ teamId }) => {
  const { hasPermission } = usePermissions();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [search, setSearch] = useState('');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [viewingMember, setViewingMember] = useState<any | null>(null);
  const [form] = Form.useForm();
  
  const [isExistingUserMode, setIsExistingUserMode] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);

  const fetchGlobalUsers = async () => {
    try {
      const res = await userService.getUsers({ limit: 1000 });
      setGlobalUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch global users', error);
    }
  };

  const fetchMembers = async (page = pagination.current, limit = pagination.pageSize) => {
    try {
      setLoading(true);
      const res = await teamService.getTeamMembers(teamId, { page, limit, search });
      setMembers(res.data);
      setPagination({ current: res.meta.page, pageSize: res.meta.limit });
    } catch (error) {
      message.error('Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await teamService.getTeamRoles(teamId);
      setRoles(res);
    } catch (error) {
      message.error('Failed to fetch team roles');
    }
  };

  useEffect(() => {
    fetchMembers(1);
    fetchRoles();
    fetchGlobalUsers();
  }, [teamId, search]);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchMembers(newPagination.current, newPagination.pageSize);
  };

  const handleOpenModal = (member?: any) => {
    if (member) {
      setEditingMember(member);
      form.setFieldsValue({ roleId: member.roleId });
      setIsExistingUserMode(false);
    } else {
      setEditingMember(null);
      form.resetFields();
      setIsExistingUserMode(true);
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingMember(null);
    form.resetFields();
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingMember) {
        await teamService.updateMemberRole(teamId, editingMember.userId, values.roleId);
        message.success('Member role updated successfully');
      } else {
        await teamService.addTeamMember(teamId, values);
        message.success('Member added successfully');
      }
      handleCloseModal();
      fetchMembers();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save member');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await teamService.removeTeamMember(teamId, userId);
      message.success('Member removed successfully');
      fetchMembers();
    } catch (error) {
      message.error('Failed to remove member');
    }
  };

  const handleBlock = async (userId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await teamService.blockTeamMember(teamId, userId);
      } else {
        await teamService.unblockTeamMember(teamId, userId);
      }
      message.success(`Member ${isActive ? 'blocked' : 'unblocked'} successfully`);
      fetchMembers();
    } catch (error) {
      message.error('Failed to update member status');
    }
  };

  const columns: ColumnsType<any> = [
    {
      title: 'Name',
      dataIndex: ['user', 'name'],
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: ['user', 'email'],
      key: 'email',
    },
    {
      title: 'Designation',
      dataIndex: ['user', 'designation'],
      key: 'designation',
      render: (text: string) => text || '-',
    },
    {
      title: 'Role',
      dataIndex: ['role', 'name'],
      key: 'role',
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
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} onClick={() => setViewingMember(record)} />
          {hasPermission('teams:write') && (
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          )}
          {hasPermission('teams:write') && (
            <Popconfirm
              title={record.status === 'ACTIVE' ? 'Block Member' : 'Unblock Member'}
              onConfirm={() => handleBlock(record.userId, record.status === 'ACTIVE')}
            >
              <Button type="text" danger={record.status === 'ACTIVE'} icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} />
            </Popconfirm>
          )}
          {hasPermission('teams:write') && (
            <Popconfirm
              title="Remove this member from the team?"
              onConfirm={() => handleDelete(record.userId)}
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
    <div>
      <div className="mb-4 flex justify-between items-center">
        <Input.Search
          placeholder="Search members..."
          allowClear
          onSearch={setSearch}
          style={{ width: 300 }}
        />
        {hasPermission('teams:write') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add Member
          </Button>
        )}
      </div>

      <Table 
        columns={columns} 
        dataSource={members} 
        rowKey="id" 
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      <Modal
        title={editingMember ? 'Edit Team Member' : 'Add Team Member'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {editingMember ? (
            <>
              <Descriptions column={1} size="small" className="mb-4">
                <Descriptions.Item label="Name">{editingMember.user?.name}</Descriptions.Item>
                <Descriptions.Item label="Email">{editingMember.user?.email}</Descriptions.Item>
              </Descriptions>
              <Form.Item
                name="roleId"
                label="Role"
                rules={[{ required: true, message: 'Please select a role' }]}
              >
                <Select placeholder="Select a team role">
                  {roles.map(r => (
                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              {!editingMember && (
                <div className="mb-4">
                  <span className="mr-2">Add Existing Global User?</span>
                  <Switch checked={isExistingUserMode} onChange={setIsExistingUserMode} />
                </div>
              )}
              
              {isExistingUserMode ? (
                <Form.Item
                  name="existingUserId"
                  label="Select Global User"
                  rules={[{ required: true, message: 'Please select a user' }]}
                >
                  <Select 
                    showSearch
                    placeholder="Search users..."
                    optionFilterProp="children"
                    onChange={(val) => {
                      const user = globalUsers.find(u => u.id === val);
                      if (user) {
                        form.setFieldsValue({
                          name: user.name,
                          email: user.email,
                          designation: user.designation || 'Member'
                        });
                      }
                    }}
                  >
                    {globalUsers.map(u => (
                      <Select.Option key={u.id} value={u.id}>{u.name} ({u.email})</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null}

              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please enter name' }]}
              >
                <Input placeholder="e.g. John Doe" readOnly={isExistingUserMode} />
              </Form.Item>
              
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="e.g. john@example.com" readOnly={isExistingUserMode} />
              </Form.Item>

              <Form.Item
                name="designation"
                label="Designation"
                rules={[{ required: true, message: 'Please enter designation' }]}
              >
                <Input placeholder="e.g. Software Engineer" readOnly={isExistingUserMode} />
              </Form.Item>

              {!isExistingUserMode && (
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[{ required: true, message: 'Please enter a password' }, { min: 6, message: 'Password must be at least 6 characters' }]}
                >
                  <Input.Password placeholder="Set user password" />
                </Form.Item>
              )}

              <Form.Item
                name="roleId"
                label="Role"
                rules={[{ required: true, message: 'Please select a role' }]}
              >
                <Select placeholder="Select a team role">
                  {roles.map(r => (
                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={handleCloseModal}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingMember ? 'Update Role' : 'Add Member'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Member Details"
        open={!!viewingMember}
        onCancel={() => setViewingMember(null)}
        footer={[
          <Button key="close" onClick={() => setViewingMember(null)}>
            Close
          </Button>
        ]}
      >
        {viewingMember && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Name">{viewingMember.user?.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{viewingMember.user?.email}</Descriptions.Item>
            <Descriptions.Item label="Designation">{viewingMember.user?.designation || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="User Status">
              <Tag color={viewingMember.user?.status === 'ACTIVE' ? 'green' : 'red'}>
                {viewingMember.user?.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Team Role">{viewingMember.role?.name}</Descriptions.Item>
            <Descriptions.Item label="Membership Status">
              <Tag color={viewingMember.status === 'ACTIVE' ? 'green' : 'red'}>
                {viewingMember.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Joined Team">
              {new Date(viewingMember.createdAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
