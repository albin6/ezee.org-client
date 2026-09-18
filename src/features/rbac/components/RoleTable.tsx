import React, { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, Empty, Spin } from 'antd';
import { EditOutlined, DeleteOutlined, MenuOutlined, ArrowUpOutlined, ArrowDownOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
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

const SortableRow = (props: RowProps) => {
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

const Row = (props: RowProps) => {
  if (props.className?.includes('ant-table-placeholder')) {
    return <tr {...props} />;
  }
  return <SortableRow {...props} />;
};

export const RoleTable: React.FC<RoleTableProps> = ({ roles, isLoading, onEdit, onDelete }) => {
  const { hasPermission } = usePermissions();
  const { updateHierarchy } = useRbacStore();
  const [expandedRolePerms, setExpandedRolePerms] = useState<Record<string, boolean>>({});

  const toggleExpandRolePerms = (roleId: string) => {
    setExpandedRolePerms(prev => ({ ...prev, [roleId]: !prev[roleId] }));
  };

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

  const handleMoveRole = async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= roles.length) return;
    const newRoles = arrayMove(roles, currentIndex, targetIndex);
    await updateHierarchy(newRoles);
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
      render: (text: string, _: unknown, index: number) => (
        <div className="flex items-center gap-2">
          <strong className="text-gray-800 capitalize">{text}</strong>
          {index === 0 && (
            <Tag color="gold" className="text-[10px] leading-tight m-0">
              Highest Authority
            </Tag>
          )}
        </div>
      ),
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
    <div>
      {/* Desktop DnD Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden p-6">
        <div className="mb-2 text-xs text-gray-500">
          Drag handles to reorder authority hierarchy.
        </div>
        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext
            items={roles.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table
              scroll={{ x: 'max-content' }}
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

      {/* Mobile Role Cards View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="py-12 flex justify-center bg-white rounded-xl"><Spin /></div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl">
            <Empty description="No roles found" />
          </div>
        ) : (
          roles.map((role, index) => {
            const isExpanded = !!expandedRolePerms[role.id];
            const perms = role.permissions || [];
            const visiblePerms = isExpanded ? perms : perms.slice(0, 4);

            return (
              <div 
                key={role.id}
                className="bg-white border border-gray-100 rounded-xl p-4 space-y-3 shadow-sm"
              >
                {/* Header: Hierarchy & Name & Up/Down Controls */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-800">
                        #{index + 1}
                      </span>
                      {index === 0 ? (
                        <Tag color="gold" className="text-[10px] m-0 font-medium">
                          Highest Authority
                        </Tag>
                      ) : (
                        <span className="text-xs text-gray-400">Authority Rank</span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 text-base capitalize truncate m-0">
                      {role.name}
                    </h4>
                  </div>

                  {/* Reorder Up/Down for Mobile */}
                  {hasPermission('roles:write') && (
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shrink-0">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={index === 0}
                        onClick={() => handleMoveRole(index, 'up')}
                        className="h-8 w-8 flex items-center justify-center text-gray-600 hover:text-blue-600 disabled:text-gray-300"
                      />
                      <div className="w-[1px] h-5 bg-gray-200" />
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={index === roles.length - 1}
                        onClick={() => handleMoveRole(index, 'down')}
                        className="h-8 w-8 flex items-center justify-center text-gray-600 hover:text-blue-600 disabled:text-gray-300"
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                {role.description ? (
                  <p className="text-xs text-gray-600 m-0 line-clamp-2">
                    {role.description}
                  </p>
                ) : (
                  <span className="text-xs text-gray-400 italic">No description provided</span>
                )}

                {/* Permissions Section */}
                <div className="bg-gray-50/70 p-2.5 rounded-lg border border-gray-100">
                  <div className="text-[11px] font-medium text-gray-500 mb-1.5 flex justify-between items-center">
                    <span>Assigned Permissions ({perms.length})</span>
                    {perms.length > 4 && (
                      <button
                        type="button"
                        onClick={() => toggleExpandRolePerms(role.id)}
                        className="text-blue-600 text-xs font-normal flex items-center gap-0.5 hover:underline cursor-pointer"
                      >
                        {isExpanded ? <>Less <UpOutlined className="text-[10px]" /></> : <>+{perms.length - 4} more <DownOutlined className="text-[10px]" /></>}
                      </button>
                    )}
                  </div>
                  {perms.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {visiblePerms.map((perm) => (
                        <Tag key={perm} color="purple" className="text-[11px] m-0 mr-1 mb-1 py-0 px-1.5">
                          {perm}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">None assigned</span>
                  )}
                </div>

                {/* Card Footer: Timestamp & Actions */}
                <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {new Date(role.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    {hasPermission('roles:write') && (
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => onEdit(role)}
                        className="text-blue-600 h-9 px-3 text-xs flex items-center gap-1 font-medium"
                      >
                        Edit
                      </Button>
                    )}
                    {hasPermission('roles:delete') && role.name.toLowerCase() !== 'admin' && (
                      <Popconfirm
                        title="Delete the role"
                        description="Are you sure you want to delete this role?"
                        onConfirm={() => onDelete(role.id)}
                        okText="Yes"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          className="h-9 px-3 text-xs flex items-center gap-1 font-medium"
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
