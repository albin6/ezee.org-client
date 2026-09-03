import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Select, Button, Tabs, Modal, Form, Input, InputNumber, Row, Col, Empty, Spin, message, Tag } from 'antd';
import { AimOutlined, PlusOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useKpiStore } from '../store/kpi.store';
import { KPIScoreCard } from '../components/KPIScoreCard';
import { KPICriteriaDrawer } from '../components/KPICriteriaDrawer';
import { kpiService } from '../api/kpi.service';
import { teamService } from '@/features/teams/api/team.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const TeamKPIPage: React.FC = () => {
  const { teamId: routeTeamId } = useParams<{ teamId?: string }>();
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('kpi:write') || hasPermission('kpi:manage_all');
  const canReadAll = hasPermission('kpi:read_all');

  const {
    cycles,
    activeCycleId,
    setActiveCycleId,
    fetchCycles,
    teamKpis,
    fetchTeamKpis,
    loading,
  } = useKpiStore();

  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [createKpiModalVisible, setCreateKpiModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();

  // 1. Fetch cycles and teams list
  useEffect(() => {
    fetchCycles();
    teamService.getTeams({ limit: 100 }).then(res => {
      setTeamsList(res.data || []);
    }).catch(() => {});
  }, [fetchCycles]);

  // 2. Resolve selected team
  useEffect(() => {
    if (routeTeamId) {
      setSelectedTeamId(routeTeamId);
    } else if (!selectedTeamId && teamsList.length > 0) {
      const userTeamId = (user as any)?.teamMembers?.[0]?.teamId;
      setSelectedTeamId(userTeamId || teamsList[0].id);
    }
  }, [routeTeamId, teamsList, user, selectedTeamId]);

  // 3. Fetch KPIs whenever selectedTeamId or activeCycleId changes
  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamKpis(selectedTeamId);
    }
  }, [selectedTeamId, activeCycleId, fetchTeamKpis]);

  const currentTeam = teamsList.find(t => t.id === selectedTeamId);

  const handleCreateKpi = async () => {
    if (!selectedTeamId || !activeCycleId) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await kpiService.createKpi({
        cycleId: activeCycleId,
        teamId: selectedTeamId,
        targetType: values.targetType,
        kpiCode: values.kpiCode.toUpperCase(),
        title: values.title,
        description: values.description,
        weightage: values.weightage,
        targetValue: values.targetValue,
        unit: values.unit,
      });

      message.success('KPI defined successfully');
      setCreateKpiModalVisible(false);
      form.resetFields();
      fetchTeamKpis(selectedTeamId);
    } catch (err: any) {
      if (err.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const teamLevelKpis = teamKpis.filter(k => k.targetType === 'TEAM');
  const memberLevelKpis = teamKpis.filter(k => k.targetType === 'MEMBER');

  return (
    <PageContainer>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <AimOutlined className="text-indigo-600" />
            <span>{currentTeam?.name ? `${currentTeam.name} KPIs` : 'Team KPIs'}</span>
            {currentTeam?.type === 'TOWER' && (
              <Tag color="purple">Tower Level Team</Tag>
            )}
          </div>
        }
        description="Manage team-level goals, criteria factors, and individual member performance scorecards"
        extra={
          <div className="flex items-center gap-3">
            {/* Team selector (available if user has broad access or multiple teams exist) */}
            {canReadAll && (
              <Select
                className="w-48"
                placeholder="Switch Team"
                value={selectedTeamId}
                onChange={setSelectedTeamId}
                options={teamsList.map(t => ({
                  label: `${t.name} ${t.type === 'TOWER' ? '(Tower)' : ''}`,
                  value: t.id,
                }))}
              />
            )}

            <Select
              className="w-44"
              value={activeCycleId}
              onChange={setActiveCycleId}
              options={cycles.map(c => ({
                label: c.name,
                value: c.id,
              }))}
            />

            {canWrite && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateKpiModalVisible(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Define KPI
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        defaultActiveKey="team"
        items={[
          {
            key: 'team',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <TeamOutlined /> Team Operational KPIs ({teamLevelKpis.length})
              </span>
            ),
            children: (
              loading ? (
                <div className="flex justify-center py-20"><Spin size="large" /></div>
              ) : teamLevelKpis.length === 0 ? (
                <Empty description="No team-level KPIs defined for this cycle" className="my-16">
                  {canWrite && (
                    <Button type="primary" onClick={() => setCreateKpiModalVisible(true)} className="bg-indigo-600">
                      Define First Team KPI
                    </Button>
                  )}
                </Empty>
              ) : (
                <Row gutter={[16, 16]}>
                  {teamLevelKpis.map(kpi => (
                    <Col key={kpi.id} xs={24} md={12} xl={8}>
                      <KPIScoreCard kpi={kpi} />
                    </Col>
                  ))}
                </Row>
              )
            ),
          },
          {
            key: 'members',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <UserOutlined /> Member Scorecards ({memberLevelKpis.length})
              </span>
            ),
            children: (
              loading ? (
                <div className="flex justify-center py-20"><Spin size="large" /></div>
              ) : memberLevelKpis.length === 0 ? (
                <Empty description="No individual member KPIs defined for this cycle" className="my-16" />
              ) : (
                <Row gutter={[16, 16]}>
                  {memberLevelKpis.map(kpi => (
                    <Col key={kpi.id} xs={24} md={12} xl={8}>
                      <KPIScoreCard kpi={kpi} />
                    </Col>
                  ))}
                </Row>
              )
            ),
          },
        ]}
      />

      {/* Embedded Criteria Drawer */}
      <KPICriteriaDrawer />

      {/* Define New KPI Modal */}
      <Modal
        title="Define New Key Performance Indicator"
        open={createKpiModalVisible}
        onCancel={() => setCreateKpiModalVisible(false)}
        onOk={handleCreateKpi}
        confirmLoading={submitting}
        okText="Create KPI"
        okButtonProps={{ className: 'bg-indigo-600' }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ targetType: 'TEAM', weightage: 10, unit: '%' }}
        >
          <Form.Item name="targetType" label="Target Scope" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Team Operational KPI', value: 'TEAM' },
                { label: 'Individual Member KPI', value: 'MEMBER' },
              ]}
            />
          </Form.Item>

          <div className="grid grid-cols-3 gap-3">
            <Form.Item
              name="kpiCode"
              label="Short Code"
              rules={[{ required: true, message: 'Code required (e.g. SLA_RATE)' }]}
            >
              <Input placeholder="SLA_RATE" />
            </Form.Item>

            <Form.Item
              name="weightage"
              label="Weightage (%)"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={100} className="w-full" />
            </Form.Item>

            <Form.Item
              name="unit"
              label="Unit"
              rules={[{ required: true }]}
            >
              <Input placeholder="%" />
            </Form.Item>
          </div>

          <Form.Item
            name="title"
            label="Detailed Title"
            rules={[{ required: true, message: 'Please enter KPI title' }]}
          >
            <Input placeholder="e.g., Ticket First-Response SLA Adherence Rate" />
          </Form.Item>

          <Form.Item name="targetValue" label="Target Goal Value" rules={[{ required: true }]}>
            <InputNumber className="w-full" placeholder="e.g., 95" />
          </Form.Item>

          <Form.Item name="description" label="Measurement Objective & Notes">
            <Input.TextArea rows={2} placeholder="Clarify what this KPI targets and expected outcome..." />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
