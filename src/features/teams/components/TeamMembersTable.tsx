import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, message, Popconfirm, Select, Input, Descriptions, Tag, Switch, Empty, Spin, Pagination } from 'antd';
import { PlusOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, EditOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
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
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
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
      setPagination({ 
        current: res.meta.page, 
        pageSize: res.meta.limit,
        total: res.meta.total || res.data.length
      });
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
      {/* Search & Actions Header */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <Input.Search
          placeholder="Search members..."
          allowClear
          onSearch={setSearch}
          className="w-full sm:w-72"
        />
        {hasPermission('teams:write') && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto h-10 sm:h-auto text-sm font-medium"
          >
            Add Member
          </Button>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table 
          scroll={{ x: 'max-content' }}
          columns={columns} 
          dataSource={members} 
          rowKey="id" 
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl">
            <Empty description="No members found" />
          </div>
        ) : (
          members.map((record) => (
            <div 
              key={record.id} 
              className="bg-gray-50/70 hover:bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-3 transition-colors shadow-sm"
            >
              {/* Card Header: Avatar, Name, Email, and Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                    {record.user?.name ? record.user.name.charAt(0) : <UserOutlined />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm truncate leading-snug">
                      {record.user?.name || 'Unknown User'}
                    </h4>
                    <p className="text-xs text-gray-500 truncate leading-snug">
                      {record.user?.email || '-'}
                    </p>
                  </div>
                </div>
                <Tag 
                  color={record.status === 'ACTIVE' ? 'success' : 'error'}
                  className="mr-0 text-xs font-semibold capitalize shrink-0"
                >
                  {record.status?.toLowerCase()}
                </Tag>
              </div>

              {/* Badges: Role and Designation */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  Role: {record.role?.name || 'No Role'}
                </span>
                {record.user?.designation && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                    {record.user.designation}
                  </span>
                )}
              </div>

              {/* Card Footer: Touch-Friendly Action Buttons */}
              <div className="border-t border-gray-200/60 pt-2.5 flex items-center justify-between">
                <Button
                  size="middle"
                  icon={<EyeOutlined />}
                  onClick={() => setViewingMember(record)}
                  className="text-xs text-gray-600 px-3"
                >
                  Details
                </Button>
                <div className="flex items-center gap-1">
                  {hasPermission('teams:write') && (
                    <Button 
                      type="text" 
                      icon={<EditOutlined />} 
                      onClick={() => handleOpenModal(record)} 
                      className="text-gray-600 h-9 w-9 flex items-center justify-center"
                    />
                  )}
                  {hasPermission('teams:write') && (
                    <Popconfirm
                      title={record.status === 'ACTIVE' ? 'Block Member?' : 'Unblock Member?'}
                      onConfirm={() => handleBlock(record.userId, record.status === 'ACTIVE')}
                    >
                      <Button 
                        type="text" 
                        danger={record.status === 'ACTIVE'} 
                        icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} 
                        className="h-9 w-9 flex items-center justify-center"
                      />
                    </Popconfirm>
                  )}
                  {hasPermission('teams:write') && (
                    <Popconfirm
                      title="Remove member?"
                      onConfirm={() => handleDelete(record.userId)}
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        className="h-9 w-9 flex items-center justify-center"
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {pagination.total > pagination.pageSize && (
          <div className="flex justify-center pt-2">
            <Pagination
              size="small"
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={(page, pageSize) => fetchMembers(page, pageSize)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      <Modal
        title={editingMember ? 'Edit Team Member' : 'Add Team Member'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width="100%"
        style={{ maxWidth: 520 }}
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
                <Select placeholder="Select a team role" size="large">
                  {roles.map(r => (
                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              {!editingMember && (
                <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Add Existing Global User?</span>
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
                    size="large"
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
                <Input placeholder="e.g. John Doe" readOnly={isExistingUserMode} size="large" />
              </Form.Item>
              
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="e.g. john@example.com" readOnly={isExistingUserMode} size="large" />
              </Form.Item>

              <Form.Item
                name="designation"
                label="Designation"
                rules={[{ required: true, message: 'Please enter designation' }]}
              >
                <Input placeholder="e.g. Software Engineer" readOnly={isExistingUserMode} size="large" />
              </Form.Item>

              {!isExistingUserMode && (
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[{ required: true, message: 'Please enter a password' }, { min: 6, message: 'Password must be at least 6 characters' }]}
                >
                  <Input.Password placeholder="Set user password" size="large" />
                </Form.Item>
              )}

              <Form.Item
                name="roleId"
                label="Role"
                rules={[{ required: true, message: 'Please select a role' }]}
              >
                <Select placeholder="Select a team role" size="large">
                  {roles.map(r => (
                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item className="mb-0 pt-2">
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button onClick={handleCloseModal} className="w-full sm:w-auto h-10 sm:h-9">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" className="w-full sm:w-auto h-10 sm:h-9 font-medium">
                {editingMember ? 'Update Role' : 'Add Member'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Viewing Member Details Modal */}
      <Modal
        title="Member Details"
        open={!!viewingMember}
        onCancel={() => setViewingMember(null)}
        width="100%"
        style={{ maxWidth: 480 }}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewingMember(null)} className="w-full sm:w-auto">
            Close
          </Button>
        ]}
      >
        {viewingMember && (
          <Descriptions column={1} bordered size="small" className="mt-3">
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
