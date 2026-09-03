import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Row, Col, Spin, Tag } from 'antd';
import { RadarChartOutlined, SendOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useKpiStore } from '../store/kpi.store';
import { TeamKPIRadarChart } from '../components/TeamKPIRadarChart';
import { OrgPerformanceHeatmap } from '../components/OrgPerformanceHeatmap';
import { CurateKPIModal } from '../components/CurateKPIModal';
import { KPICriteriaDrawer } from '../components/KPICriteriaDrawer';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const MELAnalyticsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCurate = hasPermission('kpi:curate_report') || hasPermission('kpi:manage_all');

  const {
    cycles,
    activeCycleId,
    setActiveCycleId,
    fetchCycles,
    melOverview,
    fetchMelOverview,
    loading,
  } = useKpiStore();

  const [curateModalVisible, setCurateModalVisible] = useState(false);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  useEffect(() => {
    if (activeCycleId) {
      fetchMelOverview();
    }
  }, [activeCycleId, fetchMelOverview]);

  const handleSelectTeam = (teamId: string) => {
    navigate(`/kpi/teams/${teamId}`);
  };

  return (
    <PageContainer>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <RadarChartOutlined className="text-indigo-600" />
            <span>MEL Analytics Center</span>
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>Tower Level Governance</Tag>
          </div>
        }
        description="Holistic performance monitoring, cross-team evaluation, and executive brief curation hub"
        extra={
          <div className="flex items-center gap-3">
            <Select
              className="w-48"
              value={activeCycleId}
              onChange={setActiveCycleId}
              options={cycles.map(c => ({
                label: `${c.name} ${c.status === 'ACTIVE' ? '(Active)' : ''}`,
                value: c.id,
              }))}
            />
            {canCurate && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => setCurateModalVisible(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Curate Executive Brief
              </Button>
            )}
          </div>
        }
      />

      {loading && !melOverview ? (
        <div className="flex justify-center items-center py-24">
          <Spin size="large" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Row: Radar Chart + Health Breakdown */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <TeamKPIRadarChart 
                data={melOverview?.radarDimensions || []} 
                title="Organizational Dimension Radar"
              />
            </Col>

            <Col xs={24} lg={12}>
              <Card 
                title={<span className="font-semibold text-slate-800 text-base">Monitoring Health Index</span>}
                className="border border-slate-200 rounded-xl shadow-xs h-full"
                styles={{ body: { padding: '24px' } }}
              >
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Weighted Operational Score
                    </div>
                    <div className="text-4xl font-extrabold text-slate-800 mt-1">
                      {melOverview?.organizationScore || 0}%
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-emerald-700">
                        {melOverview?.distribution?.exceeding || 0}
                      </div>
                      <div className="text-xs font-medium text-emerald-800 mt-0.5">Exceeding (≥80%)</div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-amber-700">
                        {melOverview?.distribution?.onTrack || 0}
                      </div>
                      <div className="text-xs font-medium text-amber-800 mt-0.5">On Track (60-79%)</div>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-rose-700">
                        {melOverview?.distribution?.lagging || 0}
                      </div>
                      <div className="text-xs font-medium text-rose-800 mt-0.5">Lagging (&lt;60%)</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                    <span className="font-semibold text-slate-700">Tower Role Guidance:</span> The MEL team continuously monitors all operational units. Use the <strong>Curate Executive Brief</strong> tool to distill high-priority KPIs for the CEO and CMO.
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Bottom Table: Performance Heatmap */}
          <div>
            <OrgPerformanceHeatmap
              teams={melOverview?.teams || []}
              onSelectTeam={handleSelectTeam}
            />
          </div>
        </div>
      )}

      {/* Embedded Criteria Drawer */}
      <KPICriteriaDrawer />

      {/* Curate Executive Brief Modal */}
      {activeCycleId && (
        <CurateKPIModal
          visible={curateModalVisible}
          onClose={() => setCurateModalVisible(false)}
          teams={melOverview?.teams || []}
          cycleId={activeCycleId}
          onSuccess={() => {
            fetchMelOverview();
          }}
        />
      )}
    </PageContainer>
  );
};
