import React from 'react';
import { Table, Button, Space, Tag, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Role } from '../api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface RoleTableProps {
  roles: Role[];
  isLoading: boolean;
  onEdit: (role: Role) => void;
  onDelete: (id: string) => void;
}

export const RoleTable: React.FC<RoleTableProps> = ({ roles, isLoading, onEdit, onDelete }) => {
  const { hasPermission } = usePermissions();
  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong className="text-gray-800 capitalize">{text}</strong>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => <span className="text-gray-500">{text || 'No description'}</span>,
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_: unknown, record: Role) => (
        <Space size={[0, 8]} wrap>
          {record.permissions?.length > 0 ? (
            record.permissions.map((perm) => (
              <Tag key={perm} color="purple">{perm}</Tag>
            ))
          ) : (
            <span className="text-gray-400 italic">None assigned</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Role) => (
        <Space size="middle">
          {hasPermission('roles:write') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            >
              Edit
            </Button>
          )}
          {hasPermission('roles:delete') && record.name.toLowerCase() !== 'admin' && (
            <Popconfirm
              title="Delete the role"
              description="Are you sure you want to delete this role?"
              onConfirm={() => onDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              >
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
