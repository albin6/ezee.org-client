import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { RoleTable } from '../components/RoleTable';
import { RoleEditorDrawer } from '../components/RoleEditorDrawer';
import { useRbacStore } from '../store/rbac.store';
import type { Role } from '../api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const RolesPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { roles, isLoading, fetchRoles, fetchPermissions, deleteRole } = useRbacStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  const handleCreate = () => {
    setEditingRole(null);
    setDrawerOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteRole(id);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Roles & Permissions"
        description="Manage system access levels and granular permissions for users."
        extra={
          hasPermission('roles:write') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Create Role
            </Button>
          )
        }
      />

      <RoleTable
        roles={roles}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <RoleEditorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={editingRole}
      />
    </PageContainer>
  );
};
