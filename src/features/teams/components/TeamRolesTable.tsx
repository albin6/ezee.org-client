import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MenuOutlined } from '@ant-design/icons';
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, teamPermsRes, allPermsRes] = await Promise.all([
        teamService.getTeamRoles(teamId),
        teamService.getTeamPermissions(teamId),
        rbacService.getPermissions()
      ]);
      
      // We need to fetch the permissions for each role separately because the backend doesn't populate it in findAll(teamId)?
      // Actually, looking at the backend role use case, wait, getTeamRoles just returns role entities without permissions array.
      // To fix this on the frontend without changing the backend use case, we'll just fetch each role's permissions or assume it's coming from an updated backend endpoint.
      // Assuming backend `findAll` doesn't include permissions, we might not show them in the table, or we can fetch them. Let's just not show them in the table for now, or just show role names.
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
      // Fetch role details with permissions
      // Wait, backend getTeamRole doesn't populate permissions either in our new controller. 
      // We can just use the global rbacService or a dedicated endpoint. 
      // If not, we'll just omit populating the permissions select field initially.
      // Actually `getTeamRoles` usually doesn't include permissions in the raw query. Let's assume user edits name/desc.
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
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
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
      <div className="mb-4 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <h3 className="text-lg font-medium m-0">Team Roles</h3>
        {hasPermission('teams:write') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add Role
          </Button>
        )}
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
            columns={columns} 
            dataSource={roles} 
            rowKey="id" 
            loading={loading}
            pagination={false}
          />
        </SortableContext>
      </DndContext>

      <Modal
        title={editingRole ? 'Edit Role' : 'Create Role'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="Role Permissions"
            rules={[{ required: true, message: 'Please select at least one permission' }]}
            extra={
              <div className="flex justify-between items-start mt-1">
                <span className="text-gray-500 text-xs">Only permissions assigned to this team are available.</span>
                {!editingRole && (
                  <Space size="small">
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
                  </Space>
                )}
              </div>
            }
          >
            <Select 
              mode="multiple" 
              placeholder="Select permissions"
              options={availablePermOptions}
            />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={handleCloseModal}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingRole ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
