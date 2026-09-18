import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Select, Empty, Spin, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MenuOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { teamService } from '../api/team.service';
import { rbacService } from '@/features/rbac/api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface TeamRolesTableProps {
  teamId: string;
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

export const TeamRolesTable: React.FC<TeamRolesTableProps> = ({ teamId }) => {
  const { hasPermission } = usePermissions();
  const [roles, setRoles] = useState<any[]>([]);
  const [teamPermNames, setTeamPermNames] = useState<string[]>([]);
  const [allPerms, setAllPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [form] = Form.useForm();

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
      
      setRoles(newRoles);
      try {
        const hierarchy = newRoles.map((role, index) => ({ id: role.id, level: index }));
        await teamService.updateRoleHierarchy(teamId, hierarchy);
      } catch (error) {
        message.error('Failed to update hierarchy');
        fetchData();
      }
    }
  };

  const handleMoveRole = async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= roles.length) return;
    const newRoles = arrayMove(roles, currentIndex, targetIndex);
    setRoles(newRoles);
    try {
      const hierarchy = newRoles.map((role, index) => ({ id: role.id, level: index }));
      await teamService.updateRoleHierarchy(teamId, hierarchy);
      message.success('Role hierarchy updated');
    } catch (error) {
      message.error('Failed to update hierarchy');
      fetchData();
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, teamPermsRes, allPermsRes] = await Promise.all([
        teamService.getTeamRoles(teamId),
        teamService.getTeamPermissions(teamId),
        rbacService.getPermissions()
      ]);
      
      setRoles(rolesRes);
      setTeamPermNames(teamPermsRes);
      setAllPerms(allPermsRes);
    } catch (error) {
      message.error('Failed to fetch roles data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const handleOpenModal = async (role?: any) => {
    if (role) {
      setEditingRole(role);
      form.setFieldsValue({ ...role, permissions: role.permissions || [] }); 
    } else {
      setEditingRole(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingRole(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRole) {
        await teamService.updateTeamRole(teamId, editingRole.id, values);
        message.success('Role updated successfully');
      } else {
        await teamService.createTeamRole(teamId, values);
        message.success('Role created successfully');
      }
      handleCloseModal();
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save role');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await teamService.deleteTeamRole(teamId, id);
      message.success('Role deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete role');
    }
  };

  const columns: ColumnsType<any> = [
    {
      key: 'sort',
      width: 50,
      render: () => <MenuOutlined style={{ cursor: 'grab', color: '#999' }} />,
    },
    {
      title: 'Name (Highest Authority Top)',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, _, index: number) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{text}</span>
          {index === 0 && (
            <Tag color="gold" className="text-[10px] leading-tight">
              Highest Authority
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => <span className="text-gray-600">{desc || '-'}</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {hasPermission('teams:write') && (
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} onPointerDown={(e) => e.stopPropagation()} />
          )}
          {hasPermission('teams:write') && (
            <Popconfirm
              title="Delete this role?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} onPointerDown={(e) => e.stopPropagation()} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const availablePermOptions = allPerms
    .filter(p => teamPermNames.includes(p.name))
    .map(p => ({ label: `${p.module}: ${p.description || p.name}`, value: p.name }));

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div>
          <h3 className="text-base sm:text-lg font-medium m-0 text-gray-900">Team Roles</h3>
          <p className="text-xs text-gray-500 m-0 hidden sm:block">Drag roles to reorder authority hierarchy.</p>
        </div>
        {hasPermission('teams:write') && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto h-10 sm:h-auto font-medium"
          >
            Add Role
          </Button>
        )}
      </div>

      {/* Desktop DnD Table */}
      <div className="hidden md:block">
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
              columns={columns} 
              dataSource={roles} 
              rowKey="id" 
              loading={loading}
              pagination={false}
            />
          </SortableContext>
        </DndContext>
      </div>

      {/* Mobile Role Cards with Up/Down Hierarchy Controls */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl">
            <Empty description="No roles found" />
          </div>
        ) : (
          roles.map((role, index) => (
            <div 
              key={role.id}
              className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 space-y-2.5 shadow-sm"
            >
              {/* Card Header: Hierarchy Pill & Name */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-gray-200 text-gray-800">
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
                  <h4 className="font-semibold text-gray-900 text-sm truncate">
                    {role.name}
                  </h4>
                </div>

                {/* Mobile Reorder Controls */}
                {hasPermission('teams:write') && (
                  <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
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
              {role.description && (
                <p className="text-xs text-gray-600 m-0 line-clamp-2">
                  {role.description}
                </p>
              )}

              {/* Footer Actions */}
              {hasPermission('teams:write') && (
                <div className="border-t border-gray-200/60 pt-2 flex items-center justify-end gap-1">
                  <Button 
                    type="text" 
                    icon={<EditOutlined />} 
                    onClick={() => handleOpenModal(role)} 
                    className="text-gray-600 h-9 px-3 text-xs flex items-center gap-1"
                  >
                    Edit
                  </Button>
                  <Popconfirm
                    title="Delete this role?"
                    onConfirm={() => handleDelete(role.id)}
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
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Role Create / Edit Modal */}
      <Modal
        title={editingRole ? 'Edit Role' : 'Create Role'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width="100%"
        style={{ maxWidth: 520 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input size="large" placeholder="e.g. Team Lead" />
          </Form.Item>
          
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Short role description..." />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="Role Permissions"
            rules={[{ required: true, message: 'Please select at least one permission' }]}
            extra={
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 mt-1.5">
                <span className="text-gray-500 text-xs">Only permissions assigned to this team are available.</span>
                {!editingRole && (
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => {
                        const allValues = availablePermOptions.map(p => p.value);
                        form.setFieldsValue({ permissions: allValues });
                      }}
                      className="p-0 h-auto text-xs"
                    >
                      Select All
                    </Button>
                    <span className="text-gray-300 text-xs">|</span>
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => {
                        form.setFieldsValue({ permissions: [] });
                      }}
                      className="p-0 h-auto text-xs text-gray-500 hover:text-gray-700"
                    >
                      Deselect All
                    </Button>
                  </div>
                )}
              </div>
            }
          >
            <Select 
              mode="multiple" 
              placeholder="Select permissions"
              options={availablePermOptions}
              size="large"
            />
          </Form.Item>

          <Form.Item className="mb-0 pt-2">
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button onClick={handleCloseModal} className="w-full sm:w-auto h-10 sm:h-9">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" className="w-full sm:w-auto h-10 sm:h-9 font-medium">
                {editingRole ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
