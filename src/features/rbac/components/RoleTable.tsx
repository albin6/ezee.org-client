import React from 'react';
import { Table, Button, Space, Tag, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, MenuOutlined } from '@ant-design/icons';
import type { Role } from '../api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRbacStore } from '../store/rbac.store';

interface RoleTableProps {
  roles: Role[];
  isLoading: boolean;
  onEdit: (role: Role) => void;
  onDelete: (id: string) => void;
}

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

const Row = (props: RowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    cursor: 'move',
    ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#f5f5f5' } : {}),
  };

  return <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners} />;
};

export const RoleTable: React.FC<RoleTableProps> = ({ roles, isLoading, onEdit, onDelete }) => {
  const { hasPermission } = usePermissions();
  const { updateHierarchy } = useRbacStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 1 },
    })
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      const activeIndex = roles.findIndex((i) => i.id === active.id);
      const overIndex = roles.findIndex((i) => i.id === over?.id);
      const newRoles = arrayMove(roles, activeIndex, overIndex);
      await updateHierarchy(newRoles);
    }
  };

  const columns = [
    {
      key: 'sort',
      width: 50,
      render: () => <MenuOutlined style={{ cursor: 'grab', color: '#999' }} />,
    },
    {
      title: 'Role Name (Highest Authority Top)',
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
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag on button click
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
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag on button click
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
      <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext
          items={roles.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <Table
            components={{
              body: {
                row: Row,
              },
            }}
            rowKey="id"
            columns={columns}
            dataSource={roles}
            loading={isLoading}
            pagination={false}
          />
        </SortableContext>
      </DndContext>
    </div>
  );
};
