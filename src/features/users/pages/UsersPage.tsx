import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Tag, Space, Popconfirm, Select, Empty, Spin, Pagination } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useUserStore } from '../store/user.store';
import { useRbacStore } from '@/features/rbac/store/rbac.store';
import type { User } from '../types';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const UsersPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { users, total, page, limit, isLoading, fetchUsers, createUser, updateUser, deleteUser, changeUserStatus } = useUserStore();
  const { roles, fetchRoles } = useRbacStore();
  const [search, setSearch] = useState('');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUsers({ page, limit, search });
  }, [page, limit, search]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    fetchUsers({ page: 1, limit, search: value });
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      form.setFieldsValue({ ...user });
    } else {
      setEditingUser(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, values);
        message.success('User updated successfully');
      } else {
        await createUser(values);
        message.success('User created successfully');
      }
      setIsModalVisible(false);
    } catch (error: any) {
      // Error handled in store, but could also display here
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('User deleted');
    } catch (error: any) {
    }
  };

  const handleBlock = async (id: string, block: boolean) => {
    try {
      await changeUserStatus(id, block ? 'BLOCKED' : 'ACTIVE');
      message.success(`User ${block ? 'blocked' : 'unblocked'}`);
    } catch (error: any) {
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Designation', dataIndex: 'designation', key: 'designation' },
    { 
      title: 'Role', 
      key: 'role',
      render: (_: any, record: User) => {
        const role = roles.find(r => r.id === record.roleId);
        return role ? <Tag color="blue">{role.name}</Tag> : <span className="text-gray-400">None</span>;
      }
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'error'}>{status}</Tag>
      )
    },
    { 
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          {hasPermission('users:write') && (
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          )}
          {hasPermission('users:block') && (
            <Popconfirm
              title={record.status === 'ACTIVE' ? 'Block User' : 'Unblock User'}
              onConfirm={() => handleBlock(record.id, record.status === 'ACTIVE')}
            >
              <Button type="text" danger={record.status === 'ACTIVE'} icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} />
            </Popconfirm>
          )}
          {hasPermission('users:delete') && (
            <Popconfirm
              title="Are you sure you want to delete this user?"
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
        title="Users Management" 
        extra={
          hasPermission('users:write') && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto h-10 sm:h-auto font-medium"
            >
              Add User
            </Button>
          )
        } 
      />
      
      <div className="bg-white p-3.5 sm:p-6 rounded-xl shadow-sm">
        {/* Search Controls */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
          <Input.Search 
            placeholder="Search users by name or email..." 
            onSearch={handleSearch} 
            allowClear 
            className="w-full sm:w-72"
          />
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table 
            scroll={{ x: 'max-content' }}
            columns={columns} 
            dataSource={users} 
            rowKey="id" 
            loading={isLoading}
            pagination={{
              current: page,
              pageSize: limit,
              total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (p, s) => { 
                fetchUsers({ page: p, limit: s, search }); 
              }
            }}
          />
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Spin /></div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-xl">
              <Empty description="No users found" />
            </div>
          ) : (
            users.map((record) => {
              const role = roles.find(r => r.id === record.roleId);
              return (
                <div 
                  key={record.id} 
                  className="bg-gray-50/70 hover:bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-3 transition-colors shadow-sm"
                >
                  {/* Card Header: Avatar, Name, Email, Status Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                        {record.name ? record.name.charAt(0) : <UserOutlined />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate leading-snug">
                          {record.name}
                        </h4>
                        <p className="text-xs text-gray-500 truncate leading-snug">
                          {record.email}
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

                  {/* Badges: Role & Designation */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {role ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        Role: {role.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
                        No Role
                      </span>
                    )}
                    {record.designation && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {record.designation}
                      </span>
                    )}
                  </div>

                  {/* Card Footer: Touch-Friendly Action Buttons */}
                  <div className="border-t border-gray-200/60 pt-2.5 flex items-center justify-end gap-1">
                    {hasPermission('users:write') && (
                      <Button 
                        type="text" 
                        icon={<EditOutlined />} 
                        onClick={() => handleOpenModal(record)} 
                        className="text-gray-600 h-9 px-3 text-xs flex items-center gap-1"
                      >
                        Edit
                      </Button>
                    )}
                    {hasPermission('users:block') && (
                      <Popconfirm
                        title={record.status === 'ACTIVE' ? 'Block this user?' : 'Unblock this user?'}
                        onConfirm={() => handleBlock(record.id, record.status === 'ACTIVE')}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button 
                          type="text" 
                          danger={record.status === 'ACTIVE'} 
                          icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} 
                          className="h-9 px-3 text-xs flex items-center gap-1"
                        >
                          {record.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                        </Button>
                      </Popconfirm>
                    )}
                    {hasPermission('users:delete') && (
                      <Popconfirm
                        title="Delete this user?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                      >
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />} 
                          className="h-9 px-3 text-xs flex items-center gap-1"
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Mobile Pagination */}
          {total > limit && (
            <div className="flex justify-center pt-2">
              <Pagination
                size="small"
                current={page}
                pageSize={limit}
                total={total}
                onChange={(p, s) => fetchUsers({ page: p, limit: s, search })}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width="100%"
        style={{ maxWidth: 520 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input size="large" placeholder="e.g. John Doe" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter valid email' }]}>
            <Input disabled={!!editingUser} size="large" placeholder="e.g. john@example.com" />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}>
              <Input.Password size="large" placeholder="Set user password" />
            </Form.Item>
          )}
          <Form.Item name="designation" label="Designation">
            <Input size="large" placeholder="e.g. Software Engineer" />
          </Form.Item>
          <Form.Item name="roleId" label="Global Role">
            <Select allowClear placeholder="Select a role" size="large">
              {roles.filter(r => !r.teamId).map(role => (
                <Select.Option key={role.id} value={role.id}>{role.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item className="mb-0 pt-2">
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button onClick={() => setIsModalVisible(false)} className="w-full sm:w-auto h-10 sm:h-9">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" className="w-full sm:w-auto h-10 sm:h-9 font-medium">
                Save
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
