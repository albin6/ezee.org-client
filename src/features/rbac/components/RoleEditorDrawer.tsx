import React, { useEffect } from 'react';
import { Drawer, Form, Input, Button, Checkbox, Space, message, Divider } from 'antd';
import type { Role, Permission } from '../api/rbac.service';
import { useRbacStore } from '../store/rbac.store';

interface RoleEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  role: Role | null;
}

export const RoleEditorDrawer: React.FC<RoleEditorDrawerProps> = ({ open, onClose, role }) => {
  const [form] = Form.useForm();
  const { createRole, updateRole, assignPermissions, permissions, isLoading } = useRbacStore();

  useEffect(() => {
    if (open) {
      if (role) {
        form.setFieldsValue({
          name: role.name,
          description: role.description,
          // Convert array of permission names back to array of IDs if needed, 
          // but our store only gives names for roles. We need to match names to IDs.
          permissionIds: role.permissions
            .map(pName => permissions.find(p => p.name === pName)?.id)
            .filter(Boolean),
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, role, form, permissions]);

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (role) {
        await updateRole(role.id, { name: values.name, description: values.description });
        if (values.permissionIds) {
          await assignPermissions(role.id, values.permissionIds);
        }
        message.success('Role updated successfully');
      } else {
        const newRole = await createRole({ name: values.name, description: values.description });
        if (values.permissionIds && values.permissionIds.length > 0) {
          await assignPermissions(newRole.id, values.permissionIds);
        }
        message.success('Role created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Validation or Submission failed', error);
      // message handled by store usually, or we can add it here.
    }
  };

  return (
    <Drawer
      title={role ? 'Edit Role' : 'Create New Role'}
      width={480}
      onClose={onClose}
      open={open}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} type="primary" loading={isLoading}>
            Submit
          </Button>
        </Space>
      }
    >
      <Form layout="vertical" form={form} requiredMark={false}>
        <Form.Item
          name="name"
          label="Role Name"
          rules={[{ required: true, message: 'Please enter role name' }]}
        >
          <Input placeholder="e.g. Manager" disabled={role?.name.toLowerCase() === 'admin'} />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea rows={3} placeholder="Describe the responsibilities of this role" />
        </Form.Item>

        <Divider />
        <h3 className="text-lg font-medium mb-4">Permissions</h3>

        <Form.Item name="permissionIds">
          <Checkbox.Group className="w-full">
            <div className="flex flex-col gap-6">
              {Object.entries(permissionsByModule).map(([module, modulePerms]) => (
                <div key={module} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="font-semibold text-gray-800 mb-3">{module}</div>
                  <div className="grid grid-cols-1 gap-2">
                    {modulePerms.map(perm => (
                      <Checkbox key={perm.id} value={perm.id} className="text-gray-600">
                        {perm.name} <span className="text-xs text-gray-400 block ml-6">{perm.description}</span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Drawer>
  );
};
