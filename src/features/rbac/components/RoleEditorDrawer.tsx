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
          // Convert array of permission names back to array of IDs if needed
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
    }
  };

  return (
    <Drawer
      title={<span className="font-semibold text-gray-900">{role ? 'Edit Role' : 'Create New Role'}</span>}
      width="100%"
      style={{ maxWidth: 500 }}
      onClose={onClose}
      open={open}
      styles={{ body: { paddingBottom: 24 } }}
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
          <Input.TextArea rows={3} placeholder="Describe the responsibilities of this role" />
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
                          const moduleIds = modulePerms.map(p => p.id);
                          const combined = Array.from(new Set([...currentSelected, ...moduleIds]));
                          form.setFieldsValue({ permissionIds: combined });
                        }}
                        className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                      >
                        Select all
                      </Button>
                      <span className="text-gray-300 text-xs">|</span>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const currentSelected: string[] = form.getFieldValue('permissionIds') || [];
                          const moduleIds = new Set(modulePerms.map(p => p.id));
                          form.setFieldsValue({ permissionIds: currentSelected.filter(id => !moduleIds.has(id)) });
                        }}
                        className="p-0 h-auto text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {modulePerms.map(perm => (
                      <label
                        key={perm.id}
                        className="p-2.5 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 flex items-start gap-2.5 cursor-pointer transition-colors shadow-2xs select-none"
                      >
                        <Checkbox value={perm.id} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-gray-800 leading-snug break-words">
                            {perm.name}
                          </div>
                          {perm.description && (
                            <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                              {perm.description}
                            </div>
                          )}
                        </div>
                      </label>
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
