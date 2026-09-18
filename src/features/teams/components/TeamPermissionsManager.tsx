import React, { useState, useEffect, useMemo } from 'react';
import { Button, Checkbox, message, Spin, Collapse } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { teamService } from '../api/team.service';
import { rbacService } from '@/features/rbac/api/rbac.service';
import type { Permission } from '@/features/rbac/api/rbac.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface TeamPermissionsManagerProps {
  teamId: string;
}

export const TeamPermissionsManager: React.FC<TeamPermissionsManagerProps> = ({ teamId }) => {
  const { hasPermission } = usePermissions();
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [teamPermNames, setTeamPermNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allRes, teamRes] = await Promise.all([
        rbacService.getPermissions(),
        teamService.getTeamPermissions(teamId)
      ]);
      setAllPermissions(allRes);
      setTeamPermNames(teamRes);
    } catch (error) {
      message.error('Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await teamService.updateTeamPermissions(teamId, teamPermNames);
      message.success('Team permissions updated successfully');
    } catch (error) {
      message.error('Failed to update team permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (permName: string, checked: boolean) => {
    if (checked) {
      setTeamPermNames(prev => [...prev, permName]);
    } else {
      setTeamPermNames(prev => prev.filter(p => p !== permName));
    }
  };

  const permissionsByModule = useMemo(() => {
    const grouped = allPermissions.reduce((acc, curr) => {
      if (!acc[curr.module]) {
        acc[curr.module] = [];
      }
      acc[curr.module].push(curr);
      return acc;
    }, {} as Record<string, Permission[]>);
    return grouped;
  }, [allPermissions]);

  if (loading) return <div className="p-8 text-center"><Spin /></div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 m-0">Team Permissions</h3>
          <p className="text-gray-500 text-xs sm:text-sm m-0">
            Define maximum permissions this team can distribute to its roles.
          </p>
        </div>
        {hasPermission('teams:write') && (
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={saving}
            className="w-full sm:w-auto h-10 sm:h-auto font-medium"
          >
            Save Changes
          </Button>
        )}
      </div>

      {/* Collapse by Module */}
      <Collapse 
        defaultActiveKey={Object.keys(permissionsByModule)}
        items={Object.entries(permissionsByModule).map(([module, perms]) => {
          const selectedCount = perms.filter(p => teamPermNames.includes(p.name)).length;
          
          return {
            key: module,
            label: (
              <div className="flex items-center justify-between pr-2 flex-wrap gap-2">
                <span className="font-semibold capitalize text-gray-800 text-sm sm:text-base">
                  {module}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  selectedCount > 0 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedCount} / {perms.length} enabled
                </span>
              </div>
            ),
            children: (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {perms.map(perm => {
                  const isChecked = teamPermNames.includes(perm.name);
                  return (
                    <div
                      key={perm.id}
                      onClick={() => {
                        if (hasPermission('teams:write')) {
                          handleCheckboxChange(perm.name, !isChecked);
                        }
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                        isChecked
                          ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                          : 'bg-gray-50/50 border-gray-100 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCheckboxChange(perm.name, e.target.checked);
                        }}
                        disabled={!hasPermission('teams:write')}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs sm:text-sm leading-snug break-words">
                          {perm.description || perm.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                          {perm.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          };
        })}
      />

      {/* Bottom Save Button for long scrolling on mobile */}
      {hasPermission('teams:write') && (
        <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end sm:hidden">
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={saving}
            className="w-full h-10 font-medium"
          >
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
};
