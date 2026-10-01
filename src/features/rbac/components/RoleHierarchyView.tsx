import React, { useState } from 'react';
import { Card, Tag, Button, Modal, Select, message, Empty, Tooltip, Spin } from 'antd';
import {
  BranchesOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { Role } from '../api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface RoleHierarchyViewProps {
  roles: Role[];
  isLoading: boolean;
  onEditRole: (role: Role) => void;
  onUpdateHierarchy: (nodes: { id: string; parentRoleIds: string[]; level?: number }[]) => Promise<void>;
  requiredPermission?: string;
  scopeLabel?: string;
}

export const RoleHierarchyView: React.FC<RoleHierarchyViewProps> = ({
  roles,
  isLoading,
  onEditRole,
  onUpdateHierarchy,
  requiredPermission = 'roles:write',
  scopeLabel = 'Platform',
}) => {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(requiredPermission);

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Group roles by level
  const roleMap = new Map<string, Role>(roles.map((r) => [r.id, r]));
  const levelsMap = new Map<number, Role[]>();

  for (const role of roles) {
    const lvl = role.level ?? 0;
    if (!levelsMap.has(lvl)) {
      levelsMap.set(lvl, []);
    }
    levelsMap.get(lvl)!.push(role);
  }

  // Sorted unique levels
  const sortedLevels = Array.from(levelsMap.keys()).sort((a, b) => a - b);

  // Compute children map
  const childrenMap = new Map<string, string[]>();
  for (const r of roles) {
    childrenMap.set(r.id, []);
  }
  for (const r of roles) {
    for (const pId of r.parentRoleIds || []) {
      if (childrenMap.has(pId)) {
        childrenMap.get(pId)!.push(r.id);
      }
    }
  }

  const handleOpenParentModal = (role: Role) => {
    setSelectedRole(role);
    setSelectedParentIds(role.parentRoleIds || []);
    setModalOpen(true);
  };

  const handleSaveParents = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      // Construct updated hierarchy array
      const updatedNodes = roles.map((r) => ({
        id: r.id,
        parentRoleIds: r.id === selectedRole.id ? selectedParentIds : r.parentRoleIds || [],
      }));

      await onUpdateHierarchy(updatedNodes);
      message.success(`Updated inheritance for ${selectedRole.name}`);
      setModalOpen(false);
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update hierarchy. Check for circular references.';
      message.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (roles.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
        <Empty description={`No ${scopeLabel.toLowerCase()} roles configured yet.`} />
      </div>
    );
  }

  return (
    <Spin spinning={isLoading}>
      <div className="flex flex-col gap-6">
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-4 sm:p-5 rounded-2xl border border-blue-100/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ApartmentOutlined className="text-lg" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 m-0">
              {scopeLabel} Role Inheritance Structure
            </h3>
            <p className="text-xs text-gray-500 m-0 mt-0.5">
              Roles are organized by authority tiers. Roles inherit authority from their parent branches.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/80 py-1.5 px-3 rounded-lg border border-gray-200/60 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{roles.length} Roles Across {sortedLevels.length} Tiers</span>
        </div>
      </div>

      {/* Levels Timeline / Tree View */}
      <div className="space-y-6">
        {sortedLevels.map((level, idx) => {
          const levelRoles = levelsMap.get(level) || [];
          const isHighest = level === 0;

          return (
            <div key={level} className="relative">
              {/* Connector line to next level */}
              {idx < sortedLevels.length - 1 && (
                <div className="absolute left-6 top-12 bottom-[-24px] w-0.5 bg-dashed bg-gray-200 z-0 hidden sm:block"></div>
              )}

              {/* Tier Header */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                    isHighest
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  L{level}
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  {isHighest ? 'Root Tier (Highest Authority)' : `Tier Level ${level} Subordinates`}
                </span>
                <span className="text-xs text-gray-400">({levelRoles.length} roles)</span>
              </div>

              {/* Roles in this level */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:ml-9">
                {levelRoles.map((role) => {
                  const parentNames = (role.parentRoleIds || [])
                    .map((pId) => roleMap.get(pId)?.name)
                    .filter(Boolean);

                  const childrenNames = (childrenMap.get(role.id) || [])
                    .map((cId) => roleMap.get(cId)?.name)
                    .filter(Boolean);

                  return (
                    <Card
                      key={role.id}
                      size="small"
                      className="rounded-xl border border-gray-200/80 hover:border-blue-400 hover:shadow-md transition-all duration-200 bg-white"
                      styles={{ body: { padding: '16px' } }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 text-base m-0 capitalize">
                            {role.name}
                          </h4>
                          {isHighest && (
                            <Tag color="gold" className="text-[10px] m-0 leading-tight">
                              Highest
                            </Tag>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Tooltip title="Configure Parent Roles">
                              <Button
                                size="small"
                                type="text"
                                icon={<BranchesOutlined />}
                                onClick={() => handleOpenParentModal(role)}
                                className="text-gray-500 hover:text-blue-600"
                              />
                            </Tooltip>
                            <Tooltip title="Edit Role & Permissions">
                              <Button
                                size="small"
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => onEditRole(role)}
                                className="text-gray-500 hover:text-blue-600"
                              />
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      {role.description && (
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                          {role.description}
                        </p>
                      )}

                      {/* Parent Relationships */}
                      <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                        <div className="flex items-start gap-1.5">
                          <span className="text-gray-400 shrink-0 font-medium">Inherits From:</span>
                          <div className="flex flex-wrap gap-1">
                            {parentNames.length > 0 ? (
                              parentNames.map((name, i) => (
                                <Tag key={i} color="blue" className="text-[11px] m-0">
                                  {name}
                                </Tag>
                              ))
                            ) : (
                              <span className="text-gray-400 italic">None (Root)</span>
                            )}
                          </div>
                        </div>

                        {/* Subordinates / Children */}
                        <div className="flex items-start gap-1.5">
                          <span className="text-gray-400 shrink-0 font-medium">Subordinates:</span>
                          <div className="flex flex-wrap gap-1">
                            {childrenNames.length > 0 ? (
                              childrenNames.map((name, i) => (
                                <Tag key={i} color="cyan" className="text-[11px] m-0">
                                  {name}
                                </Tag>
                              ))
                            ) : (
                              <span className="text-gray-400 italic">None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Badge */}
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <SafetyCertificateOutlined className="text-emerald-500" />
                          <span>{role.permissions?.length || 0} permissions</span>
                        </span>
                        <span>Level {role.level ?? 0}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for updating parents of selected role */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <BranchesOutlined className="text-blue-600" />
            <span>Configure Hierarchy for {selectedRole?.name}</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSaveParents}
        confirmLoading={saving}
        okText="Update Inheritance"
        destroyOnHidden
      >
        <div className="py-2 space-y-4">
          <p className="text-xs text-gray-500">
            Select one or more parent roles for <strong>{selectedRole?.name}</strong>. This role will become subordinate to the selected parents, and its hierarchy level will automatically adjust.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Parent Roles (Inherits Authority From)
            </label>
            <Select
              mode="multiple"
              className="w-full"
              size="large"
              placeholder="Select parent roles"
              value={selectedParentIds}
              onChange={setSelectedParentIds}
              options={roles
                .filter((r) => r.id !== selectedRole?.id)
                .map((r) => ({
                  value: r.id,
                  label: `${r.name} (Level ${r.level ?? 0})`,
                }))}
            />
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200/60 text-xs text-amber-800">
            ⚠️ <strong>Circular inheritance protection</strong>: A role cannot inherit from itself directly or indirectly. The system will reject any updates that cause a circular loop.
          </div>
        </div>
      </Modal>
    </div>
    </Spin>
  );
};
