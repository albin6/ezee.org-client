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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Team Permissions</h3>
          <p className="text-gray-500 text-sm">Select the maximum permissions this team can distribute to its roles.</p>
        </div>
        {hasPermission('teams:write') && (
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={saving}
          >
            Save Changes
          </Button>
        )}
      </div>

      <Collapse defaultActiveKey={Object.keys(permissionsByModule)}>
        {Object.entries(permissionsByModule).map(([module, perms]) => (
          <Collapse.Panel header={<span className="font-semibold capitalize">{module}</span>} key={module}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {perms.map(perm => (
                <Checkbox
                  key={perm.id}
                  checked={teamPermNames.includes(perm.name)}
                  onChange={(e) => handleCheckboxChange(perm.name, e.target.checked)}
                  disabled={!hasPermission('teams:write')}
                >
                  {perm.description || perm.name}
                </Checkbox>
              ))}
            </div>
          </Collapse.Panel>
        ))}
      </Collapse>
    </div>
  );
};
