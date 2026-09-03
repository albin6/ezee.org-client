import React, { useEffect } from 'react';
import { Card, Select, Progress, Row, Col, Spin, Tag } from 'antd';
import { DashboardOutlined, SafetyCertificateOutlined, RiseOutlined, AlertOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useKpiStore } from '../store/kpi.store';
import { ExecutiveReportCard } from '../components/ExecutiveReportCard';

export const ExecutiveDashboardPage: React.FC = () => {
  const {
    cycles,
    activeCycleId,
    setActiveCycleId,
    fetchCycles,
    melOverview,
    fetchMelOverview,
    latestExecutiveReport,
    fetchLatestExecutiveReport,
    loading,
  } = useKpiStore();

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  useEffect(() => {
    if (activeCycleId) {
      fetchMelOverview();
      fetchLatestExecutiveReport();
    }
  }, [activeCycleId, fetchMelOverview, fetchLatestExecutiveReport]);

  const orgScore = melOverview?.organizationScore || 0;
  const laggingTeamsCount = melOverview?.distribution?.lagging || 0;

  return (
    <PageContainer>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <DashboardOutlined className="text-indigo-600" />
            <span>Executive KPI Portal</span>
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>C-Suite Leadership</Tag>
          </div>
        }
        description="High-signal organizational performance cockpit and curated MEL executive briefs"
        extra={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Evaluation Cycle:</span>
            <Select
              className="w-48"
              value={activeCycleId}
              onChange={setActiveCycleId}
              options={cycles.map(c => ({
                label: `${c.name} ${c.status === 'ACTIVE' ? '(Active)' : ''}`,
                value: c.id,
              }))}
            />
          </div>
        }
      />

      {loading && !melOverview ? (
        <div className="flex justify-center items-center py-24">
          <Spin size="large" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Macro Metric Gauges */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card className="border border-slate-200 rounded-xl shadow-xs" styles={{ body: { padding: '20px' } }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Org Health Score
                    </div>
                    <div className="text-3xl font-extrabold text-slate-800 mt-1">
                      {orgScore}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <RiseOutlined className="text-emerald-600" /> Across operational delivery teams
                    </div>
                  </div>
                  <Progress
                    type="circle"
                    percent={orgScore}
                    size={64}
                    strokeColor={orgScore >= 80 ? '#52c41a' : orgScore >= 60 ? '#faad14' : '#f5222d'}
                  />
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card className="border border-slate-200 rounded-xl shadow-xs" styles={{ body: { padding: '20px' } }}>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Operational Health Status
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Tag color="success" className="px-3 py-1 font-semibold text-sm">
                    {melOverview?.distribution?.exceeding || 0} Exceeding
                  </Tag>
                  <Tag color="warning" className="px-3 py-1 font-semibold text-sm">
                    {melOverview?.distribution?.onTrack || 0} On Track
                  </Tag>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Total monitored teams: {melOverview?.teams?.length || 0}
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card className="border border-slate-200 rounded-xl shadow-xs" styles={{ body: { padding: '20px' } }}>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Critical Focus Areas
                </div>
                <div className="text-3xl font-extrabold text-rose-600 mt-1 flex items-center gap-2">
                  {laggingTeamsCount} <AlertOutlined className="text-xl" />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Teams currently requiring leadership intervention (&lt;60%)
                </div>
              </Card>
            </Col>
          </Row>

          {/* Curated Executive Brief Card */}
          <div>
            <ExecutiveReportCard report={latestExecutiveReport} />
          </div>
        </div>
      )}
    </PageContainer>
  );
};
