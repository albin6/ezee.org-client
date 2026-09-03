import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Descriptions, Spin, Tag, message } from 'antd';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { teamService } from '../api/team.service';
import type { Team } from '../api/team.service';
import { TeamMembersTable } from '../components/TeamMembersTable';
import { TeamRolesTable } from '../components/TeamRolesTable';
import { TeamPermissionsManager } from '../components/TeamPermissionsManager';

export const TeamDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      teamService.getTeam(id)
        .then(setTeam)
        .catch(() => message.error('Failed to load team details'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-12"><Spin size="large" /></div>
      </PageContainer>
    );
  }

  if (!team) {
    return <PageContainer><div>Team not found.</div></PageContainer>;
  }

  const items = [
    {
      key: '1',
      label: 'Overview',
      children: (
        <div>
          <Descriptions title="Team Information" bordered>
            <Descriptions.Item label="Name">{team.name}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={team.type === 'TOWER' ? 'purple' : 'blue'}>
                {team.type === 'TOWER' ? 'Tower Level (Oversight)' : 'Operational Delivery'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Priority Order">{team.priorityOrder ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={team.status === 'ACTIVE' ? 'success' : 'error'}>{team.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Description">{team.description || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Created At">{new Date(team.createdAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Updated At">{new Date(team.updatedAt).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        </div>
      )
    },
    {
      key: '2',
      label: 'Members',
      children: <TeamMembersTable teamId={team.id} />
    },
    {
      key: '3',
      label: 'Roles',
      children: <TeamRolesTable teamId={team.id} />
    },
    {
      key: '4',
      label: 'Permissions',
      children: <TeamPermissionsManager teamId={team.id} />
    }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title={`Team Details: ${team.name}`} 
      />
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <Tabs defaultActiveKey="1" items={items} destroyOnHidden={true} />
      </div>
    </PageContainer>
  );
};
