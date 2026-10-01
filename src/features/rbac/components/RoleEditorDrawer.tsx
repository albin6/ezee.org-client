import React, { useEffect } from 'react';
import { Drawer, Form, Input, Button, Checkbox, Space, message, Divider, Select } from 'antd';
import type { Role, Permission } from '../api/rbac.service';
import { useRbacStore } from '../store/rbac.store';

interface RoleEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  role: Role | null;
}

export const RoleEditorDrawer: React.FC<RoleEditorDrawerProps> = ({ open, onClose, role }) => {
  const [form] = Form.useForm();
  const { createRole, updateRole, assignPermissions, permissions, roles, isLoading } = useRbacStore();

  useEffect(() => {
    if (open) {
      if (role) {
        form.setFieldsValue({
          name: role.name,
          description: role.description,
          parentRoleIds: role.parentRoleIds || [],
          // Convert array of permission names back to array of IDs if needed
          permissionIds: role.permissions
            .map((pName) => permissions.find((p) => p.name === pName)?.id)
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

  const availableParentRoles = roles.filter((r) => !role || r.id !== role.id);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const parentRoleIds = values.parentRoleIds || [];

      if (role) {
        await updateRole(role.id, {
          name: values.name,
          description: values.description,
          parentRoleIds,
        });
        if (values.permissionIds) {
          await assignPermissions(role.id, values.permissionIds);
        }
        message.success('Role updated successfully');
      } else {
        const newRole = await createRole({
          name: values.name,
          description: values.description,
          parentRoleIds,
        });
        if (values.permissionIds && values.permissionIds.length > 0) {
          await assignPermissions(newRole.id, values.permissionIds);
        }
        message.success('Role created successfully');
      }
      onClose();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to save role';
      message.error(errorMsg);
      console.error('Validation or Submission failed', error);
    }
  };

  return (
    <Drawer
      title={<span className="font-semibold text-gray-900">{role ? 'Edit Role' : 'Create New Role'}</span>}
      size="default"
      onClose={onClose}
      open={open}
      styles={{
        body: { paddingBottom: 24 },
        wrapper: { width: '100%', maxWidth: 520 },
      }}
      extra={
        <Space className="hidden sm:flex">
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} type="primary" loading={isLoading}>
            Submit
          </Button>
        </Space>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 p-1">
          <Button onClick={onClose} className="w-full sm:w-auto h-10 sm:h-9">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            type="primary"
            loading={isLoading}
            className="w-full sm:w-auto h-10 sm:h-9 font-medium"
          >
            {role ? 'Update Role' : 'Create Role'}
          </Button>
        </div>
      }
    >
      <Form layout="vertical" form={form} requiredMark={false}>
        <Form.Item
          name="name"
          label={<span className="font-medium text-gray-700">Role Name</span>}
          rules={[{ required: true, message: 'Please enter role name' }]}
        >
          <Input
            size="large"
            placeholder="e.g. Manager"
            disabled={role?.name.toLowerCase() === 'admin'}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={<span className="font-medium text-gray-700">Description</span>}
        >
          <Input.TextArea rows={2} placeholder="Describe the responsibilities of this role" />
        </Form.Item>

        <Form.Item
          name="parentRoleIds"
          label={
            <div className="flex flex-col">
              <span className="font-medium text-gray-700">Parent Role(s) / Inherits From</span>
              <span className="text-[11px] text-gray-400 font-normal">
                Subordinate to the selected roles. Authority level is automatically derived from the hierarchy.
              </span>
            </div>
          }
        >
          <Select
            mode="multiple"
            placeholder="Select parent role(s) (optional for root roles)"
            size="large"
            allowClear
            optionFilterProp="label"
            options={availableParentRoles.map((r) => ({
              value: r.id,
              label: `${r.name} (Level ${r.level ?? 0})`,
            }))}
          />
        </Form.Item>

        <Divider className="my-4" />

        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-900 m-0">Permissions</h3>
          <p className="text-xs text-gray-500 m-0">Select granular system permissions to attach to this role.</p>
        </div>

        <Form.Item name="permissionIds">
          <Checkbox.Group className="w-full">
            <div className="flex flex-col gap-4">
              {Object.entries(permissionsByModule).map(([module, modulePerms]) => (
                <div key={module} className="bg-gray-50/70 p-3 sm:p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-semibold text-gray-800 capitalize text-sm">
                      {module}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const currentSelected: string[] = form.getFieldValue('permissionIds') || [];
                          const modulePermIds = modulePerms.map((p) => p.id);
                          const newSelected = Array.from(new Set([...currentSelected, ...modulePermIds]));
                          form.setFieldsValue({ permissionIds: newSelected });
                        }}
                        className="text-xs text-blue-600 p-0 h-auto"
                      >
                        All
                      </Button>
                      <span className="text-gray-300">|</span>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const currentSelected: string[] = form.getFieldValue('permissionIds') || [];
                          const modulePermIds = modulePerms.map((p) => p.id);
                          const newSelected = currentSelected.filter((id) => !modulePermIds.includes(id));
                          form.setFieldsValue({ permissionIds: newSelected });
                        }}
                        className="text-xs text-gray-500 p-0 h-auto"
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modulePerms.map((perm) => (
                      <Checkbox key={perm.id} value={perm.id} className="text-xs text-gray-600">
                        {perm.name}
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
