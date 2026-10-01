import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Select, Empty, Spin, Tag, Segmented } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MenuOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  UnorderedListOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { teamService } from '../api/team.service';
import { rbacService } from '@/features/rbac/api/rbac.service';
import { RoleHierarchyView } from '@/features/rbac/components/RoleHierarchyView';
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
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [form] = Form.useForm();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 1 },
    }),
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
        rbacService.getPermissions(),
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
      form.setFieldsValue({
        ...role,
        parentRoleIds: role.parentRoleIds || [],
        permissions: role.permissions || [],
      });
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
      const errMsg = error.response?.data?.message || error.message || 'Failed to save role';
      message.error(errMsg);
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

  const handleUpdateHierarchyGraph = async (nodes: any[]) => {
    try {
      await teamService.updateRoleHierarchy(teamId, nodes);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update hierarchy';
      message.error(msg);
      throw err;
    }
  };

  const availableParentRoles = roles.filter((r) => !editingRole || r.id !== editingRole.id);

  const columns: ColumnsType<any> = [
    {
      key: 'sort',
      width: 50,
      render: () => <MenuOutlined style={{ cursor: 'grab', color: '#999' }} />,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{text}</span>
          {record.level === 0 && (
            <Tag color="gold" className="text-[10px] leading-tight">
              Root Authority
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Tier Level',
      key: 'level',
      width: 100,
      render: (_: any, record: any) => (
        <Tag color="cyan">Level {record.level ?? 0}</Tag>
      ),
    },
    {
      title: 'Inherits From',
      key: 'parents',
      render: (_: any, record: any) => {
        const parents = (record.parentRoleIds || [])
          .map((pId: string) => roles.find((r) => r.id === pId)?.name)
          .filter(Boolean);
        return parents.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {parents.map((pName: string, i: number) => (
              <Tag key={i} color="blue" className="text-[11px] m-0">
                {pName}
              </Tag>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">None (Root)</span>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => <span className="text-gray-600">{desc || '-'}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {hasPermission('teams:write') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          )}
          {hasPermission('teams:write') && (
            <Popconfirm
              title="Delete this role?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const availablePermOptions = allPerms
    .filter((p) => teamPermNames.includes(p.name))
    .map((p) => ({ label: `${p.module}: ${p.description || p.name}`, value: p.name }));

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div>
          <h3 className="text-base sm:text-lg font-medium m-0 text-gray-900">Team Roles</h3>
          <p className="text-xs text-gray-500 m-0 hidden sm:block">
            Configure team roles and dynamic authority hierarchy.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'table' | 'hierarchy')}
            options={[
              { label: 'Role List', value: 'table', icon: <UnorderedListOutlined /> },
              { label: 'Hierarchy Tree', value: 'hierarchy', icon: <ApartmentOutlined /> },
            ]}
            className="p-1 bg-gray-100 rounded-xl"
          />
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
      </div>

      {viewMode === 'table' ? (
        <>
          {/* Desktop DnD Table */}
          <div className="hidden md:block">
            <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
              <SortableContext items={roles.map((i) => i.id)} strategy={verticalListSortingStrategy}>
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
              <div className="py-8 text-center bg-white rounded-xl border border-gray-100">
                <Spin />
              </div>
            ) : roles.length === 0 ? (
              <div className="py-8 text-center bg-white rounded-xl border border-gray-100">
                <Empty description="No team roles created yet" />
              </div>
            ) : (
              roles.map((role, idx) => (
                <div
                  key={role.id}
                  className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{role.name}</span>
                      <Tag color="cyan" className="text-[10px]">
                        L{role.level ?? 0}
                      </Tag>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasPermission('teams:write') && (
                        <>
                          <Button
                            size="small"
                            type="text"
                            icon={<ArrowUpOutlined />}
                            disabled={idx === 0}
                            onClick={() => handleMoveRole(idx, 'up')}
                          />
                          <Button
                            size="small"
                            type="text"
                            icon={<ArrowDownOutlined />}
                            disabled={idx === roles.length - 1}
                            onClick={() => handleMoveRole(idx, 'down')}
                          />
                          <Button
                            size="small"
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenModal(role)}
                          />
                          <Popconfirm
                            title="Delete this role?"
                            onConfirm={() => handleDelete(role.id)}
                            okText="Yes"
                            cancelText="No"
                            okButtonProps={{ danger: true }}
                          >
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </>
                      )}
                    </div>
                  </div>
                  {role.description && <p className="text-xs text-gray-500 m-0">{role.description}</p>}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <RoleHierarchyView
          roles={roles}
          isLoading={loading}
          onEditRole={handleOpenModal}
          onUpdateHierarchy={handleUpdateHierarchyGraph}
          requiredPermission="teams:write"
          scopeLabel="Team"
        />
      )}

      {/* Role Creation / Edit Modal */}
      <Modal
        title={editingRole ? 'Edit Team Role' : 'Create Team Role'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-2">
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
            name="parentRoleIds"
            label={
              <div className="flex flex-col">
                <span className="font-medium text-gray-700">Parent Role(s) / Inherits From</span>
                <span className="text-[11px] text-gray-400 font-normal">
                  Subordinate to selected roles within this team.
                </span>
              </div>
            }
          >
            <Select
              mode="multiple"
              placeholder="Select parent role(s)"
              size="large"
              allowClear
              options={availableParentRoles.map((r) => ({
                value: r.id,
                label: `${r.name} (Level ${r.level ?? 0})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="Role Permissions"
            rules={[{ required: true, message: 'Please select at least one permission' }]}
            extra={
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 mt-1.5">
                <span className="text-gray-500 text-xs">
                  Only permissions assigned to this team are available.
                </span>
                {!editingRole && (
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        const allValues = availablePermOptions.map((p) => p.value);
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
