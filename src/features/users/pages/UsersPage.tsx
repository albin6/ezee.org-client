import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Tag, Space, Popconfirm, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Tag>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add User
            </Button>
          )
        } 
      />
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="mb-4 w-full sm:w-64 sm:max-w-md">
          <Input.Search placeholder="Search users by name or email..." onSearch={handleSearch} allowClear />
        </div>

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
            onChange: (p, s) => { 
              fetchUsers({ page: p, limit: s, search }); 
            }
          }}
        />
      </div>

      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="designation" label="Designation">
            <Input />
          </Form.Item>
          <Form.Item name="roleId" label="Global Role">
            <Select allowClear placeholder="Select a role">
              {roles.filter(r => !r.teamId).map(role => (
                <Select.Option key={role.id} value={role.id}>{role.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
};
