import React, { useEffect, useState } from 'react';
import { Button, Segmented } from 'antd';
import { PlusOutlined, UnorderedListOutlined, ApartmentOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { RoleTable } from '../components/RoleTable';
import { RoleHierarchyView } from '../components/RoleHierarchyView';
import { RoleEditorDrawer } from '../components/RoleEditorDrawer';
import { useRbacStore } from '../store/rbac.store';
import type { Role } from '../api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const RolesPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { roles, isLoading, fetchRoles, fetchPermissions, deleteRole, updateHierarchyGraph } = useRbacStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');

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
        description="Manage system access levels, dynamic role inheritance, and granular permissions."
        extra={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Segmented
              value={viewMode}
              onChange={(val) => setViewMode(val as 'table' | 'hierarchy')}
              options={[
                { label: 'Role List', value: 'table', icon: <UnorderedListOutlined /> },
                { label: 'Hierarchy Tree', value: 'hierarchy', icon: <ApartmentOutlined /> },
              ]}
              className="p-1 bg-gray-100/90 rounded-xl"
            />
            {hasPermission('roles:write') && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                className="w-full sm:w-auto h-10 sm:h-auto font-medium"
              >
                Create Role
              </Button>
            )}
          </div>
        }
      />

      {viewMode === 'table' ? (
        <RoleTable
          roles={roles}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <RoleHierarchyView
          roles={roles}
          isLoading={isLoading}
          onEditRole={handleEdit}
          onUpdateHierarchy={updateHierarchyGraph}
          requiredPermission="roles:write"
          scopeLabel="Platform"
        />
      )}

      <RoleEditorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={editingRole}
      />
    </PageContainer>
  );
};
